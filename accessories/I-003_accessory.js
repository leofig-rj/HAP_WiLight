var Accessory = require('../').Accessory;
var Service = require('../').Service;
var Characteristic = require('../').Characteristic;
var uuid = require('../').uuid;

var hostTCP = "#HOST#";
var portTCP = 46000;
var numSerie = "#NUMSERIE#";
var mac = "#MAC#";
var hab1 = #HAB1#;
var hab2 = #HAB2#;
var hab3 = #HAB3#;
var modelo = "I-003";

// TCP Setup
var net = require('net');
var clientTCP = new net.Socket();

clientTCP.on('connect', function() {
  WILIGHT.ativo = true;
  WILIGHT.solicitaDado();
console.log('Connected ' + numSerie);
});

clientTCP.on('close', function() {
console.log('CLOSED!!! ' + numSerie);
  WILIGHT.ativo = false;
  if (hab1) {LIGHT_1.refresh()};
  if (hab2) {LIGHT_2.refresh()};
  if (hab3) {LIGHT_3.refresh()};
});

clientTCP.on('error', function() {
console.log('ERROR!!! ' + numSerie);
});

// onde atualizo estado...
clientTCP.on('data', function(data) {
  var ret = '' + data;
  WILIGHT.falhas = 0;
  if(ret.substr(0, 16) === '&' + numSerie + "065") {
    // sinalizo retorno
    WILIGHT.retorno = true;
    // atualizo estados...
    if (hab1) {
      LIGHT_1.comanda = false;
      light1.setCharacteristic(Characteristic.On, (ret.substr(23, 1) === "1"));
      LIGHT_1.comanda = true;
    };
    if (hab2) {
      LIGHT_2.comanda = false;
      light2.setCharacteristic(Characteristic.On, (ret.substr(24, 1) === "1"));
      LIGHT_2.comanda = true;
    };
    if (hab3) {
      LIGHT_3.comanda = false;
      light3.setCharacteristic(Characteristic.On, (ret.substr(25, 1) === "1"));
      LIGHT_3.comanda = true;
    };
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

var LIGHT_2 = {
  comanda: true,
  powerOn: false,
  
  setPowerOn: function(on) { 
    LIGHT_2.powerOn = on;
    if (LIGHT_2.comanda) {    
        if (on) {
          WILIGHT.enviaComando("003000");
        } else {
          WILIGHT.enviaComando("004000");
       };
    };
  },
  refresh: function() { 
    // atualizo estado com eles mesmo...
    LIGHT_2.comanda = false;
    light2.setCharacteristic(Characteristic.On, LIGHT_2.powerOn);
    LIGHT_2.comanda = true;
  },
  identify: function() {
    var estado = LIGHT_2.powerOn;
    light2.setCharacteristic(Characteristic.On, !estado);
    setTimeout(function() {
      light2.setCharacteristic(Characteristic.On, estado);
    }, 2000);
  }
}

var LIGHT_3 = {
  comanda: true,
  powerOn: false,
  
  setPowerOn: function(on) { 
    LIGHT_3.powerOn = on;
    if (LIGHT_3.comanda) {    
        if (on) {
          WILIGHT.enviaComando("005000");
        } else {
          WILIGHT.enviaComando("006000");
       };
    };
  },
  refresh: function() { 
    // atualizo estado com ele mesmo...
    LIGHT_3.comanda = false;
    light3.setCharacteristic(Characteristic.On, LIGHT_3.powerOn);
    LIGHT_3.comanda = true;
  },
  identify: function() {
    var estado = LIGHT_3.powerOn;
    light3.setCharacteristic(Characteristic.On, !estado);
    setTimeout(function() {
      light3.setCharacteristic(Characteristic.On, estado);
    }, 2000);
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
  if (hab1) {LIGHT_1.identify()};
  if (hab2) {LIGHT_2.identify()};
  if (hab3) {LIGHT_3.identify()};
  callback(); // success
});

// Add the actual Lightbulb Service and listen for change events from iOS.
// We can see the complete list of Services and Characteristics in `lib/gen/HomeKitTypes.js`
var light1 = null;
var light2 = null;
var light3 = null;
if (hab1) {light1 = new Service.Lightbulb("Lampada 1","1light")};
if (hab2) {light2 = new Service.Lightbulb("Lampada 2","2light")};
if (hab3) {light3 = new Service.Lightbulb("Lampada 3","3light")};

if (hab1) {
  light.addService(light1);

  light1.getCharacteristic(Characteristic.On)
    .on('set', function(value, callback) {
      LIGHT_1.setPowerOn(value);
      WILIGHT.aguardaRetorno(callback);
    });

  light1.getCharacteristic(Characteristic.On)
    .on('get', function(callback) {
      WILIGHT.solicitaDado();
      WILIGHT.aguardaRetorno(concluiGet);
      function concluiGet(err) {
        callback(err, LIGHT_1.powerOn);
      };
    });
};

if (hab2) {
  light.addService(light2);

  light2.getCharacteristic(Characteristic.On)
    .on('set', function(value, callback) {
      LIGHT_2.setPowerOn(value);
      WILIGHT.aguardaRetorno(callback);
    });

  light2.getCharacteristic(Characteristic.On)
    .on('get', function(callback) {
      WILIGHT.solicitaDado();
      WILIGHT.aguardaRetorno(concluiGet);
      function concluiGet(err) {
        callback(err, LIGHT_2.powerOn);
      };
    });
};

if (hab3) {
  light.addService(light3);

  light3.getCharacteristic(Characteristic.On)
    .on('set', function(value, callback) {
      LIGHT_3.setPowerOn(value);
      WILIGHT.aguardaRetorno(callback);
    });

  light3.getCharacteristic(Characteristic.On)
    .on('get', function(callback) {
      WILIGHT.solicitaDado();
      WILIGHT.aguardaRetorno(concluiGet);
      function concluiGet(err) {
        callback(err, LIGHT_3.powerOn);
      };
    });
};

// tentamos conectar...
WILIGHT.conecta();

// atualizamos estado a cada 30 segundos
setInterval(function() {
  WILIGHT.solicitaDado();
  WILIGHT.testaFalha();
}, 30000);
