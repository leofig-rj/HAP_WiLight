var Accessory = require('../').Accessory;
var Service = require('../').Service;
var Characteristic = require('../').Characteristic;
var uuid = require('../').uuid;

var hostTCP = "#HOST#";
var portTCP = 46000;
var numSerie = "#NUMSERIE#";
var mac = "#MAC#";
var modelo = "C-103";

// TCP
var net = require('net');
var clientTCP = new net.Socket();

clientTCP.on('connect', function() {
  WILIGHT.ativo = true;
  WILIGHT.solicitaDado();
});

clientTCP.on('close', function() {
console.log('CLOSED!!! ' + numSerie);
  WILIGHT.ativo = false;
  WIN_COVERING_1.refresh();
});

clientTCP.on('error', function() {
console.log('ERROR!!! ' + numSerie);
});

// onde atualizo estado...
clientTCP.on('data', function(data) {
  var ret = '' + data;
  if(ret.substr(0, 16) === '&' + numSerie + "067") {
    WILIGHT.falhas = 0;
    // sinalizo retorno
    WILIGHT.retorno = true;
    // atualizo estados...
      var targetPosition = ~~(ret.substr(26, 3) * 100 / 255); 
      var currentPosition = ~~(ret.substr(29, 3)); 
      var positionState = ~~(ret.substr(32, 3)); 
      WIN_COVERING_1.comanda = false;
      covering1.setCharacteristic(Characteristic.TargetPosition, targetPosition);
      covering1.setCharacteristic(Characteristic.CurrentPosition, currentPosition);
      covering1.setCharacteristic(Characteristic.PositionState, positionState);
      WIN_COVERING_1.comanda = true;
  };
});

// aqui o dispositivo de hardware é exposto ao HomeKit
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

// aqui os itens dos dispositivos de hardware são expostos ao HomeKit
var WIN_COVERING_1 = {
  comanda: true,
  currentPosition: 50, // percentage
  targetPosition: 50,  // percentage
  positionState: Characteristic.PositionState.STOPPED,

  setTarget: function(targetPosition) {
    WIN_COVERING_1.targetPosition = targetPosition;
    if (WIN_COVERING_1.comanda) {
      var b = ~~(targetPosition * 255 / 100); // uso ~~para converter para inteiro!
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
  setState: function(positionState) {
    WIN_COVERING_1.positionState = positionState;
    if (WIN_COVERING_1.comanda) {
      if (positionState = Characteristic.PositionState.INCREASING) {
        WILIGHT.enviaComando("001000");
      } else if (positionState = Characteristic.PositionState.DECREASING) {
        WILIGHT.enviaComando("002000");
      } else if (positionState = Characteristic.PositionState.STOPPED) {
        WILIGHT.enviaComando("005000");
      };
    };
  },
  refresh: function() {
    // atualizo estado com ele mesmo...
    WIN_COVERING_1.comanda = false;
    covering1.setCharacteristic(Characteristic.PositionState, WIN_COVERING_1.positionState);
    covering1.setCharacteristic(Characteristic.CurrentPosition, WIN_COVERING_1.currentPosition);
    covering1.setCharacteristic(Characteristic.TargetPosition, WIN_COVERING_1.targetPosition);
    WIN_COVERING_1.comanda = true;
  },
  identify: function() {
    var estado = LIGHT_1.powerOn;
    covering1.setCharacteristic(Characteristic.PositionState, Characteristic.PositionState.INCREASING);
    setTimeout(function() {
      covering1.setCharacteristic(Characteristic.PositionState, Characteristic.PositionState.DECREASING);
      setTimeout(function() {
        covering1.setCharacteristic(Characteristic.PositionState, Characteristic.PositionState.STOPPED);
      }, 1000);
    }, 1000);
  }
}

// Geramos um consistente UUID para nosso acessório WiLight que permanecerá o mesmo, mesmo
// que o servidor seja reiniciado.
var aux = "hap-nodejs:accessories:wilight:" + numSerie;
var lightUUID = uuid.generate(aux);

// Este é o acessório que retornará para o HAP-NodeJS que representa o nosso WiLight.
var covering = exports.accessory = new Accessory("WiLight " + numSerie.substr(6), lightUUID);

// adicionamos propriedades para publicar usando Core.js
covering.username = mac;
covering.pincode = "031-45-154";

// definimos propriedades básicas
covering
  .getService(Service.AccessoryInformation)
  .setCharacteristic(Characteristic.Manufacturer, "WiLight")
  .setCharacteristic(Characteristic.Model, modelo)
  .setCharacteristic(Characteristic.SerialNumber, numSerie);

// esperamos pelo evento "identify" para estes acessórios
covering.on('identify', function(paired, callback) {
  WIN_COVERING_1.identify();
  callback(); // success
});

// Adicionamos os serviços WindowCovering e aguardamos por eventos de mudança do iOS.
var covering1 = new Service.WindowCovering("Cortina", "1cortina");

covering
  .addService(covering1);

covering1.getCharacteristic(Characteristic.TargetPosition)
  .on('set', function(value, callback) {
    WIN_COVERING_1.setTarget(value);
    WILIGHT.aguardaRetorno(callback);
  });

covering1.getCharacteristic(Characteristic.CurrentPosition)
  .on('get', function(callback) {
    WILIGHT.solicitaDado();
    WILIGHT.aguardaRetorno(concluiGet);
    function concluiGet(err) {
      callback(err, WIN_COVERING_1.currentPosition);
    }
  });

covering1.getCharacteristic(Characteristic.PositionState)
  .on('get', function(callback) {
    WILIGHT.solicitaDado();
    WILIGHT.aguardaRetorno(concluiGet);
    function concluiGet(err) {
      callback(err, WIN_COVERING_1.positionState);
    }
  })
  .on('set', function(value, callback) {
    WIN_COVERING_1.setState(value);
    WILIGHT.aguardaRetorno(callback);
  });

// tentamos conectar...
WILIGHT.conecta();

// atualizamos estado a cada 30 segundos
setInterval(function() {
  WILIGHT.solicitaDado();
  WILIGHT.testaFalha();
}, 30000);
