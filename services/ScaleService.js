const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const net = require('net');
const EventEmitter = require('events');

/**
 * Bizerba Scale Integration Service
 * Supports both Serial (COM) and TCP/IP connections
 */
class ScaleService extends EventEmitter {
  constructor() {
    super();
    this.serialPort = null;
    this.tcpClient = null;
    this.parser = null;
    this.isConnected = false;
    this.connectionType = null; // 'serial' or 'tcp'
    this.config = {
      serial: {
        port: 'COM1', // Default COM port
        baudRate: 9600,
        dataBits: 8,
        parity: 'none',
        stopBits: 1
      },
      tcp: {
        host: '192.168.1.100', // Default IP
        port: 4001 // Default Bizerba TCP port
      }
    };
    this.lastWeight = 0;
    this.isStable = false;
    this.timeout = null;
  }

  /**
   * Connect to scale via Serial port
   */
  async connectSerial(config = {}) {
    try {
      const serialConfig = { ...this.config.serial, ...config };
      
      this.serialPort = new SerialPort({
        path: serialConfig.port,
        baudRate: serialConfig.baudRate,
        dataBits: serialConfig.dataBits,
        parity: serialConfig.parity,
        stopBits: serialConfig.stopBits,
        autoOpen: false
      });

      this.parser = this.serialPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));
      
      return new Promise((resolve, reject) => {
        this.serialPort.open((err) => {
          if (err) {
            reject(new Error(`Failed to open serial port: ${err.message}`));
            return;
          }

          this.isConnected = true;
          this.connectionType = 'serial';
          this.setupDataHandlers();
          this.emit('connected', { type: 'serial', config: serialConfig });
          resolve({ success: true, type: 'serial' });
        });
      });
    } catch (error) {
      throw new Error(`Serial connection failed: ${error.message}`);
    }
  }

  /**
   * Connect to scale via TCP/IP
   */
  async connectTCP(config = {}) {
    try {
      const tcpConfig = { ...this.config.tcp, ...config };
      
      this.tcpClient = new net.Socket();
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('TCP connection timeout'));
        }, 5000);

        this.tcpClient.connect(tcpConfig.port, tcpConfig.host, () => {
          clearTimeout(timeout);
          this.isConnected = true;
          this.connectionType = 'tcp';
          this.setupTCPHandlers();
          this.emit('connected', { type: 'tcp', config: tcpConfig });
          resolve({ success: true, type: 'tcp' });
        });

        this.tcpClient.on('error', (err) => {
          clearTimeout(timeout);
          reject(new Error(`TCP connection failed: ${err.message}`));
        });
      });
    } catch (error) {
      throw new Error(`TCP connection failed: ${error.message}`);
    }
  }

  /**
   * Setup data handlers for serial connection
   */
  setupDataHandlers() {
    if (this.parser) {
      this.parser.on('data', (data) => {
        this.processWeightData(data.toString().trim());
      });
    }

    if (this.serialPort) {
      this.serialPort.on('error', (err) => {
        this.emit('error', err);
        this.disconnect();
      });

      this.serialPort.on('close', () => {
        this.emit('disconnected');
        this.isConnected = false;
      });
    }
  }

  /**
   * Setup handlers for TCP connection
   */
  setupTCPHandlers() {
    if (this.tcpClient) {
      this.tcpClient.on('data', (data) => {
        this.processWeightData(data.toString().trim());
      });

      this.tcpClient.on('error', (err) => {
        this.emit('error', err);
        this.disconnect();
      });

      this.tcpClient.on('close', () => {
        this.emit('disconnected');
        this.isConnected = false;
      });
    }
  }

  /**
   * Process incoming weight data from scale
   * Bizerba scales typically send data in format: "ST,GS,+00000.000,kg"
   */
  processWeightData(data) {
    try {
      // Common Bizerba formats:
      // "ST,GS,+00000.000,kg" - Stable weight
      // "US,GS,+00000.000,kg" - Unstable weight
      // "ST,NT,+00000.000,kg" - Stable net weight
      
      const parts = data.split(',');
      if (parts.length >= 4) {
        const stability = parts[0]; // ST = Stable, US = Unstable
        const weightType = parts[1]; // GS = Gross, NT = Net, TR = Tare
        const weightValue = parseFloat(parts[2]);
        const unit = parts[3];

        const isStable = stability === 'ST';
        const weight = Math.abs(weightValue); // Remove sign for display

        // Update internal state
        this.lastWeight = weight;
        this.isStable = isStable;

        // Emit weight data
        this.emit('weightData', {
          weight: weight,
          unit: unit,
          stable: isStable,
          type: weightType,
          raw: data,
          timestamp: new Date().toISOString()
        });

        // If weight is stable, emit stable weight event
        if (isStable && weight > 0) {
          this.emit('stableWeight', {
            weight: weight,
            unit: unit,
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      this.emit('error', new Error(`Failed to process weight data: ${error.message}`));
    }
  }

  /**
   * Request current weight from scale
   */
  async requestWeight() {
    if (!this.isConnected) {
      throw new Error('Scale not connected');
    }

    try {
      // Bizerba command to request weight (varies by model)
      const command = 'W\r\n'; // Common weight request command
      
      if (this.connectionType === 'serial' && this.serialPort) {
        this.serialPort.write(command);
      } else if (this.connectionType === 'tcp' && this.tcpClient) {
        this.tcpClient.write(command);
      }

      // Return promise that resolves when stable weight is received
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Weight request timeout'));
        }, 5000);

        const onStableWeight = (data) => {
          clearTimeout(timeout);
          this.removeListener('stableWeight', onStableWeight);
          resolve(data);
        };

        this.once('stableWeight', onStableWeight);
      });
    } catch (error) {
      throw new Error(`Failed to request weight: ${error.message}`);
    }
  }

  /**
   * Tare the scale (zero out current weight)
   */
  async tare() {
    if (!this.isConnected) {
      throw new Error('Scale not connected');
    }

    try {
      const command = 'T\r\n'; // Common tare command
      
      if (this.connectionType === 'serial' && this.serialPort) {
        this.serialPort.write(command);
      } else if (this.connectionType === 'tcp' && this.tcpClient) {
        this.tcpClient.write(command);
      }

      return { success: true, message: 'Tare command sent' };
    } catch (error) {
      throw new Error(`Failed to tare scale: ${error.message}`);
    }
  }

  /**
   * Get available serial ports
   */
  static async getAvailablePorts() {
    try {
      const { SerialPort } = require('serialport');
      const ports = await SerialPort.list();
      return ports.map(port => ({
        path: port.path,
        manufacturer: port.manufacturer,
        serialNumber: port.serialNumber,
        vendorId: port.vendorId,
        productId: port.productId
      }));
    } catch (error) {
      throw new Error(`Failed to list serial ports: ${error.message}`);
    }
  }

  /**
   * Test connection to scale
   */
  async testConnection() {
    if (!this.isConnected) {
      throw new Error('Scale not connected');
    }

    try {
      const weightData = await this.requestWeight();
      return {
        success: true,
        connected: true,
        type: this.connectionType,
        weight: weightData.weight,
        unit: weightData.unit,
        stable: weightData.stable
      };
    } catch (error) {
      return {
        success: false,
        connected: this.isConnected,
        type: this.connectionType,
        error: error.message
      };
    }
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      type: this.connectionType,
      lastWeight: this.lastWeight,
      stable: this.isStable,
      config: this.connectionType === 'serial' ? this.config.serial : this.config.tcp
    };
  }

  /**
   * Disconnect from scale
   */
  async disconnect() {
    try {
      if (this.serialPort && this.serialPort.isOpen) {
        this.serialPort.close();
      }
      
      if (this.tcpClient && !this.tcpClient.destroyed) {
        this.tcpClient.destroy();
      }

      this.isConnected = false;
      this.connectionType = null;
      this.serialPort = null;
      this.tcpClient = null;
      this.parser = null;

      this.emit('disconnected');
      return { success: true, message: 'Disconnected from scale' };
    } catch (error) {
      throw new Error(`Failed to disconnect: ${error.message}`);
    }
  }
}

module.exports = ScaleService;