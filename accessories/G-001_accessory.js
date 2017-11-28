var Accessory = require('../').Accessory;
var Service = require('../').Service;
var Characteristic = require('../').Characteristic;
var uuid = require('../').uuid;

var hostTCP = "#HOST#";
var portTCP = 46000;
var numSerie = "#NUMSERIE#";
var mac = "#MAC#";
var modelo = "G-001";

// TCP Setup
var net = require('net');
var clientTCP = new net.Socket();

clientTCP.on('connect', function() {
  WILIGHT.ativo = true;
  WILIGHT.solicitaDado();
});

clientTCP.on('close', function() {
  WILIGHT.ativo = false;
  GARAGE_1.refresh();
});

clientTCP.on('error', function() {
console.log('ERROR!!! ' + numSerie);
});

// onde atualizo estado...
clientTCP.on('data', function(data) {
  var ret = '' + data;
  WILIGHT.falhas = 0;
  if (ret.substr(0, 16) === '&' + numSerie + "003") {
    // sinalizo retorno
    WILIGHT.retorno = true;
    // atualizo estados...
    var aberto = (ret.substr(16, 1) === "0");
    var fechado = (ret.substr(17, 1) === "0");
    // Condição em princípio não possível, mas usada para informar HK que não tem feedback
    if ((aberto)&&(fechado)) {
      // Defino o "último" comando como FECHAR.
      GARAGE_1.comanda = false;
      garage1.setCharacteristic(Characteristic.TargetDoorState, Characteristic.TargetDoorState.CLOSED);
      GARAGE_1.comanda = true;
      // Defino estado como FECHADO
      GARAGE_1.currentState = Characteristic.CurrentDoorState.CLOSED;
      garage1.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.CLOSED);
    }
    if ((aberto)&&(!fechado)) {
      if (GARAGE_1.esteveIndefinido) {
        GARAGE_1.esteveIndefinido = false;
        // Defino o "último" comando como ABRIR.
        GARAGE_1.comanda = false;
        garage1.setCharacteristic(Characteristic.TargetDoorState, Characteristic.TargetDoorState.OPEN);
        GARAGE_1.comanda = true;
      }
      GARAGE_1.currentState = Characteristic.CurrentDoorState.OPEN;
      garage1.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.OPEN);
    }
    if ((!aberto)&&(fechado)) {
      if (GARAGE_1.esteveIndefinido) {
        GARAGE_1.esteveIndefinido = false;
        // Defino o "último" comando como FECHAR.
        GARAGE_1.comanda = false;
        garage1.setCharacteristic(Characteristic.TargetDoorState, Characteristic.TargetDoorState.CLOSED);
        GARAGE_1.comanda = true;
      }
      // Defino estado como FECHADO
      GARAGE_1.currentState = Characteristic.CurrentDoorState.CLOSED;
      garage1.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.CLOSED);
    }
    if ((!aberto)&&(!fechado)) {
      GARAGE_1.esteveIndefinido = true;
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
var GARAGE_1 = {

  comanda: true,
  currentState: Characteristic.CurrentDoorState.CLOSED, 
  esteveIndefinido: true,

  setTarget: function(tgt) { 
    if (GARAGE_1.comanda) {    
      WILIGHT.enviaComando("001000");
    };
  },
  refresh: function() { 
    // atualizo estado com ele mesmo...
    GARAGE_1.comanda = false;
    garage1.setCharacteristic(Characteristic.CurrentDoorState, GARAGE_1.currentState);
    GARAGE_1.comanda = true;
  },
  identify: function() {
    // mano abrir… na realidade tanto faz abrir ou fechar
    garage1.setCharacteristic(Characteristic.TargetDoorState, Characteristic.TargetDoorState.OPEN);
  }
}

// Generate a consistent UUID for our garage Accessory that will remain the same even when
// restarting our server. We use the `uuid.generate` helper function to create a deterministic
// UUID based on an arbitrary "namespace" and the word "wilight".
var aux = "hap-nodejs:accessories:wilight:" + numSerie;
var garageUUID = uuid.generate(aux);

// This is the Accessory that we'll return to HAP-NodeJS that represents our WiLight.
var garage = exports.accessory = new Accessory("WiLight " + numSerie, garageUUID);

// Add properties for publishing (in case we're using Core.js and not BridgedCore.js)
garage.username = mac;
garage.pincode = "031-45-154";

// set some basic properties (these values are arbitrary and setting them is optional)
garage
  .getService(Service.AccessoryInformation)
  .setCharacteristic(Characteristic.Manufacturer, "WiLight")
  .setCharacteristic(Characteristic.Model, modelo)
  .setCharacteristic(Characteristic.SerialNumber, numSerie);

// listen for the "identify" event for this Accessory
garage.on('identify', function(paired, callback) {
  GARAGE_1.identify();
  callback(); // success
});

// Add the actual Lightbulb Service and listen for change events from iOS.
// We can see the complete list of Services and Characteristics in `lib/gen/HomeKitTypes.js`
var garage1 = new Service.GarageDoorOpener("Portao de Garagem","1garage");

garage
  .addService(garage1);

garage1.getCharacteristic(Characteristic.TargetDoorState)
  .on('set', function(value, callback) {
    GARAGE_1.setTarget(value);
    callback();
  });

// We want to intercept requests for our current power state so we can query the hardware itself instead of
// allowing HAP-NodeJS to return the cached Characteristic.value.
garage1.getCharacteristic(Characteristic.CurrentDoorState)
  .on('get', function(callback) {
    WILIGHT.solicitaDado();
    WILIGHT.aguardaRetorno(concluiGet);
    function concluiGet(err) {
      callback(err, GARAGE_1.currentState);
    }
  });

// tentamos conectar...
WILIGHT.conecta();

// atualizamos estado a cada 30 segundos
setInterval(function() {
  WILIGHT.solicitaDado();
  WILIGHT.testaFalha();
}, 30000);
