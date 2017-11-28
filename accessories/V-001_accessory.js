var Accessory = require('../').Accessory;
var Service = require('../').Service;
var Characteristic = require('../').Characteristic;
var uuid = require('../').uuid;

var hostTCP = "#HOST#";
var portTCP = 46000;
var numSerie = "#NUMSERIE#";
var mac = "#MAC#";
var modelo = "V-001";

// TCP Setup
var net = require('net');
var clientTCP = new net.Socket();

clientTCP.on('connect', function() {
  WILIGHT.ativo = true;
  WILIGHT.solicitaDado();
});

clientTCP.on('close', function() {
  WILIGHT.ativo = false;
  LIGHT_1.refresh();
  FAN_1.refresh();
});

clientTCP.on('error', function() {
console.log('ERROR!!! ' + numSerie);
});

// onde atualizo estado...
clientTCP.on('data', function(data) {
  var ret = '' + data;
  WILIGHT.falhas = 0;
  if(ret.substr(0, 16) === '&' + numSerie + "035") {
    // sinalizo retorno
    WILIGHT.retorno = true;
    // atualizo estados...
    LIGHT_1.comanda = false;
    light1.setCharacteristic(Characteristic.On, (ret.substr(23, 1) === "1"));
    LIGHT_1.comanda = true;
    FAN_1.comanda = false;
    if (ret.substr(24, 1) === "0") {
      fan1.setCharacteristic(Characteristic.On, true);
      fan1.setCharacteristic(Characteristic.RotationDirection, 0);
    } else {
      if (ret.substr(24, 1) === "1") {
        fan1.setCharacteristic(Characteristic.On, false);
      } else {
        fan1.setCharacteristic(Characteristic.On, true);
        fan1.setCharacteristic(Characteristic.RotationDirection, 1);
      };
    };
    if (ret.substr(25, 1) === "0") {
      fan1.setCharacteristic(Characteristic.RotationSpeed, 20);
    } else {
      if (ret.substr(25, 1) === "1") {
        fan1.setCharacteristic(Characteristic.RotationSpeed, 50);
      } else {
        fan1.setCharacteristic(Characteristic.RotationSpeed, 100);
      };
    };
    FAN_1.comanda = true;
  }
});

// here's a hardware device that we'll expose to HomeKit
var WILIGHT = {
  ativo: false,
  retorno: false,
  falhas: 0,
  falhasMAX: 5,
  
  conecta: function() { 
    clientTCP.connect(portTCP, hostTCP, function() {});
  },
  
  enviaComando: function(cmd) { 
    WILIGHT.retorno = false;
    WILIGHT.falhas = WILIGHT.falhas + 1
    if (WILIGHT.ativo&&(!clientTCP.destroyed)) {
      clientTCP.write("!" + numSerie + cmd);
    } else {
      if ((!clientTCP.connecting)&&clientTCP.destroyed) {
        WILIGHT.conecta();
      };
    };
  },
  
  solicitaDado: function() { 
    WILIGHT.enviaComando("000000");
  },
  
  testaFalha: function() { 
    if (WILIGHT.falhas > WILIGHT.falhasMAX) {
      WILIGHT.falhas = 0;
      clientTCP.destroy(55);
    };
  },
  
  aguardaRetorno: function(callback) {
    // aguardo retorno...
    var page = 0;
    var last_page = 100;
    (function loop() {
      if (!WILIGHT.ativo) {
        callback(20);
      } else {
        if (WILIGHT.retorno) {
          callback();
        } else {
          if (page <= last_page) {
            // timeout de 20 ms, chamando recursivo...
            setTimeout(function() {
              page++;
              loop();
            }, 20);
          } else {
            callback(10);
          };
        };
      };
    }());
  }
}

// here's some hardware device items that we'll expose to HomeKit
var LIGHT_1 = {
  comanda: true,
  powerOn: false,
  
  setPowerOn: function(on) { 
    LIGHT_1.powerOn = on;
    if (LIGHT_1.comanda) {    
        if (on) {
          WILIGHT.enviaComando("001000");
        } else {
          WILIGHT.enviaComando("002000");
       };
    };
  },
  refresh: function() { 
    // atualizo estado com ele mesmo...
    LIGHT_1.comanda = false;
    light1.setCharacteristic(Characteristic.On, LIGHT_1.powerOn);
    LIGHT_1.comanda = true;
  },
  identify: function() {
    var estado = LIGHT_1.powerOn;
    light1.setCharacteristic(Characteristic.On, !estado);
    setTimeout(function() {
      light1.setCharacteristic(Characteristic.On, estado);
    }, 2000);
  }
}

var FAN_1 = {
  comanda: true,
  powerOn: false,
  direction: 0, // 0 down, 1 up
  speed: 0, // percentage
  speedAux: 0, // 0 low, 1 medium, 2 high
  
  setPowerOn: function(on) { 
    FAN_1.powerOn = on;
    if (FAN_1.comanda) {    
      if (on) {
         if (FAN_1.direction === 0) {
           WILIGHT.enviaComando("003000");
         } else {
           WILIGHT.enviaComando("005000");
         };
      } else {
          WILIGHT.enviaComando("004000");
      };
    };
  },
  setDirection: function(value) {
    FAN_1.direction = value;
    if (FAN_1.comanda) {    
      if (FAN_1.powerOn) {
         if (FAN_1.direction === 0) {
           WILIGHT.enviaComando("003000");
         } else {
           WILIGHT.enviaComando("005000");
         };
      };
    };
  },
  setSpeed: function(value) {
    if (value < 30) {
      FAN_1.speed = 20;
      FAN_1.speedAux = 0;
    } else {
      if (value > 70) {
        FAN_1.speed = 100;
        FAN_1.speedAux = 2;
      } else {
        FAN_1.speed = 50;
        FAN_1.speedAux = 1;
      };
    };

    if (FAN_1.comanda) {    
      if (FAN_1.powerOn) {
         if (FAN_1.speedAux === 0) {
           WILIGHT.enviaComando("006000");
         } else {
           if (FAN_1.speedAux === 1) {
             WILIGHT.enviaComando("007000");
           } else {
             WILIGHT.enviaComando("008000");
           };
         };
      };
    };
  },
  refresh: function() { 
    // atualizo estado com ele mesmo...
    FAN_1.comanda = false;
    fan1.setCharacteristic(Characteristic.On, FAN_1.powerOn);
    fan1.setCharacteristic(Characteristic.RotationSpeed, FAN_1.speed);
    fan1.setCharacteristic(Characteristic.RotationDirection, FAN_1.direction);
    FAN_1.comanda = true;
  },
  identify: function() {
  }
}

// Generate a consistent UUID for our light Accessory that will remain the same even when
// restarting our server. We use the `uuid.generate` helper function to create a deterministic
// UUID based on an arbitrary "namespace" and the word "wilight".
var aux = "hap-nodejs:accessories:wilight:" + numSerie;
var lightUUID = uuid.generate(aux);

// This is the Accessory that we'll return to HAP-NodeJS that represents our WiLight.
var light = exports.accessory = new Accessory("WiLight " + numSerie.substr(6), lightUUID);

// Add properties for publishing (in case we're using Core.js and not BridgedCore.js)
light.username = mac;
light.pincode = "031-45-154";

// set some basic properties (these values are arbitrary and setting them is optional)
light
  .getService(Service.AccessoryInformation)
  .setCharacteristic(Characteristic.Manufacturer, "WiLight")
  .setCharacteristic(Characteristic.Model, modelo)
  .setCharacteristic(Characteristic.SerialNumber, numSerie);

// listen for the "identify" event for this Accessory
light.on('identify', function(paired, callback) {
  LIGHT_1.identify();
  callback(); // success
});

// Add the actual Lightbulb Service and listen for change events from iOS.
// We can see the complete list of Services and Characteristics in `lib/gen/HomeKitTypes.js`
var light1 = new Service.Lightbulb("Lampada","1light");
var fan1 = new Service.Fan("Ventilador","1fan");

light.addService(light1);
light.addService(fan1);

light1.getCharacteristic(Characteristic.On)
  .on('set', function(value, callback) {
    LIGHT_1.setPowerOn(value);
    WILIGHT.aguardaRetorno(callback);
  });

fan1.getCharacteristic(Characteristic.On)
  .on('set', function(value, callback) {
    FAN_1.setPowerOn(value);
    WILIGHT.aguardaRetorno(callback);
  });

// We want to intercept requests for our current power state so we can query the hardware itself instead of
// allowing HAP-NodeJS to return the cached Characteristic.value.
light1.getCharacteristic(Characteristic.On)
  .on('get', function(callback) {
    WILIGHT.solicitaDado();
    WILIGHT.aguardaRetorno(concluiGet);
    function concluiGet(err) {
      callback(err, LIGHT_1.powerOn);
    }
  });

fan1.getCharacteristic(Characteristic.On)
  .on('get', function(callback) {
    WILIGHT.solicitaDado();
    WILIGHT.aguardaRetorno(concluiGet);
    function concluiGet(err) {
      callback(err, FAN_1.powerOn);
    }
  });

// also add an "optional" Characteristic for Fan
fan1.addCharacteristic(Characteristic.RotationDirection)
  .on('get', function(callback) {
    WILIGHT.solicitaDado();
    WILIGHT.aguardaRetorno(concluiGet);
    function concluiGet(err) {
      callback(err, FAN_1.direction);
    }
  })
  .on('set', function(value, callback) {
    FAN_1.setDirection(value);
    WILIGHT.aguardaRetorno(callback);
  });

fan1.addCharacteristic(Characteristic.RotationSpeed)
  .on('get', function(callback) {
    WILIGHT.solicitaDado();
    WILIGHT.aguardaRetorno(concluiGet);
    function concluiGet(err) {
      callback(err, FAN_1.speed);
    }
  })
  .on('set', function(value, callback) {
    FAN_1.setSpeed(value);
    WILIGHT.aguardaRetorno(callback);
  });

// tentamos conectar...
WILIGHT.conecta();

// atualizamos estado a cada 30 segundos
setInterval(function() {
  WILIGHT.solicitaDado();
  WILIGHT.testaFalha();
}, 30000);
