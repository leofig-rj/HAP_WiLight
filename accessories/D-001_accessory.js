var Accessory = require('../').Accessory;
var Service = require('../').Service;
var Characteristic = require('../').Characteristic;
var uuid = require('../').uuid;

var hostTCP = "#HOST#";
var portTCP = 46000;
var numSerie = "#NUMSERIE#";
var mac = "#MAC#";
var dim1 = true;
var modelo = "D-001";

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
});

clientTCP.on('error', function() {
console.log('ERROR!!! ' + numSerie);
});

// onde atualizo estado...
clientTCP.on('data', function(data) {
  var ret = '' + data;
  WILIGHT.falhas = 0;
  if (ret.substr(0, 16) === '&' + numSerie + "034") {
    // sinalizo retorno
    WILIGHT.retorno = true;
    // atualizo estados...
    var brightness = ~~(ret.substr(24, 3) * 100 / 255); // uso ~~para converter para inteiro!
    LIGHT_1.comanda = false;
    light1.setCharacteristic(Characteristic.On, (ret.substr(23, 1) === "1"));
    if (dim1) {
      light1.setCharacteristic(Characteristic.Brightness, brightness);
    }
    LIGHT_1.comanda = true;
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
  brightness: 100, // percentage
  
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
  setBrightness: function(brightness) {
    LIGHT_1.brightness = brightness;
    if (LIGHT_1.comanda) {    
      var b = ~~(brightness * 255 / 100); // uso ~~para converter para inteiro!
      var cmd = "";
      if (b < 10) {
        cmd = "00" + b;
      } else {
        if (b < 100) {
          cmd = "0" + b;
        } else {
          cmd = "" + b;
        };
      };
      cmd = cmd + "0";
      WILIGHT.enviaComando("007004" + cmd);
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

light.addService(light1);

light1.getCharacteristic(Characteristic.On)
  .on('set', function(value, callback) {
    LIGHT_1.setPowerOn(value);
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
    };
  });

// also add an "optional" Characteristic for Brightness
if (dim1) {
  light1.addCharacteristic(Characteristic.Brightness)
    .on('get', function(callback) {
      WILIGHT.solicitaDado();
      WILIGHT.aguardaRetorno(concluiGet);
      function concluiGet(err) {
        callback(err, LIGHT_1.brightness);
      };
    })
    .on('set', function(value, callback) {
      LIGHT_1.setBrightness(value);
      WILIGHT.aguardaRetorno(callback);
    });
};

// tentamos conectar...
WILIGHT.conecta();

// atualizamos estado a cada 30 segundos
setInterval(function() {
  WILIGHT.solicitaDado();
  WILIGHT.testaFalha();
}, 30000);
