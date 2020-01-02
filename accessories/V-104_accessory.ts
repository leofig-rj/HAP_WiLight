import {
  Accessory,
  AccessoryEventTypes,
  Categories,
  Characteristic,
  CharacteristicEventTypes, CharacteristicSetCallback,
  CharacteristicValue,
  NodeCallback,
  Service,
  uuid,
  VoidCallback
} from '..';

var hostTCP = "#HOST#";
var portTCP = "#PORT#";
var numSerie = "#NUMSERIE#";
var mac = "#MAC#";
var modelo = "V-104";

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
  LIGHT_1.refresh();
  FAN_1.refresh();
});

clientTCP.on('error', function() {
console.log('ERROR!!! ' + numSerie);
});

// onde atualizo estado...
// @ts-ignore
clientTCP.on('data', function(data) {
  var ret = '' + data;
  if(ret.substr(0, 16) === '&' + numSerie + "034") {
    WILIGHT.falhas = 0;
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
      }else {
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

const timeOut = 200; // 200 ms

// aqui o dispositivo que será exposto ao HomeKit
var arrayCmd: string[] = [];

var WILIGHT = {
  ativo: false,
  retorno: false,
  falhas: 0,
  falhasMAX: 5,
  pilhaCmd: arrayCmd,
  pilhaIni: 0,
  pilhaFim: 0,
  pilhaOcupado: false,
  timeoutPilha: setTimeout ( function() { WILIGHT.retiraDaPilha() }, timeOut ),

  conecta: function() {
    clientTCP.connect(portTCP, hostTCP, function() {});
      WILIGHT.pilhaIni = 0;
      WILIGHT.pilhaFim = 0;
      WILIGHT.pilhaOcupado = false;
      if (WILIGHT.pilhaCmd.length==0) {
        for (let i=0;i<10;i++) {
          WILIGHT.pilhaCmd.push("");
        }
      };
  },

  // @ts-ignore
  enviaComando: function(cmd) {
    WILIGHT.retorno = false;
    WILIGHT.falhas = WILIGHT.falhas + 1
    if (WILIGHT.ativo&&(!clientTCP.destroyed)) {
      WILIGHT.colocaNaPilha("!" + numSerie + cmd);
    } else {
      if ((!clientTCP.connecting)&&clientTCP.destroyed) {
        WILIGHT.conecta();
      };
    };
  },

  // @ts-ignore
  colocaNaPilha: function(cmd) {
    let pilhaVazia = false;
    if (WILIGHT.pilhaIni===WILIGHT.pilhaFim) pilhaVazia = true;
    let proxPilhaFim = WILIGHT.pilhaFim + 1;
    if (proxPilhaFim==10) proxPilhaFim = 0;
    if (proxPilhaFim===WILIGHT.pilhaIni) return; // ABORTO, pilha cheia
    WILIGHT.pilhaFim = proxPilhaFim;
    WILIGHT.pilhaCmd[WILIGHT.pilhaFim] = cmd;
    if (pilhaVazia) {
        WILIGHT.retiraDaPilha();
    } else {
      // Termino o TimeOut atual...
      clearTimeout(WILIGHT.timeoutPilha);
      // Gero novo timeOut
      WILIGHT.timeoutPilha = setTimeout ( function() { WILIGHT.retiraDaPilha() }, timeOut );
    }
  },

  retiraDaPilha: function() {
    if (!WILIGHT.ativo) return; // ABORTO, inativo
    if (WILIGHT.pilhaIni===WILIGHT.pilhaFim) return; // ABORTO, pilha vazia
    if (WILIGHT.pilhaOcupado) {
      // Termino o TimeOut atual...
      clearTimeout(WILIGHT.timeoutPilha);
      // Gero novo timeOut
      WILIGHT.timeoutPilha = setTimeout ( function() { WILIGHT.retiraDaPilha() }, timeOut );
      return;
    };
    WILIGHT.pilhaOcupado = true;
    let proxPilhaIni = WILIGHT.pilhaIni + 1;
    if (proxPilhaIni==10) proxPilhaIni = 0;
    WILIGHT.pilhaIni = proxPilhaIni;
    let cmd = WILIGHT.pilhaCmd[WILIGHT.pilhaIni];

    clientTCP.write(cmd, function(){
      WILIGHT.pilhaOcupado = false;
     if (WILIGHT.pilhaIni===WILIGHT.pilhaFim) return; // ABORTO, pilha vazia
       // Termino o TimeOut atual...
       clearTimeout(WILIGHT.timeoutPilha);
       // Gero novo timeOut
       WILIGHT.timeoutPilha = setTimeout ( function() { WILIGHT.retiraDaPilha() }, timeOut );
       return;
    });

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

  // @ts-ignore
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

// Aqui os itens do dispositivo expostos ao HomeKit
var LIGHT_1 = {
  comanda: true,
  powerOn: false,

  // @ts-ignore
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

  // @ts-ignore
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
  // @ts-ignore
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
  // @ts-ignore
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

// Geramos um consistente UUID para nosso acessório WiLight que permanecerá o mesmo, mesmo
// que o servidor seja reiniciado.
var aux = "hap-nodejs:accessories:wilight:" + numSerie;
var wlUUID = uuid.generate(aux);

// Este é o acessório que retornará para o HAP-NodeJS que representa o nosso WiLight.
var wlAccessory = exports.accessory = new Accessory("WiLight " + numSerie.substr(6), wlUUID);

// adicionamos propriedades para publicar usando Core.ts
// @ts-ignore
wlAccessory.username = mac;
// @ts-ignore
wlAccessory.pincode = "031-45-154";
// @ts-ignore
wlAccessory.category = Categories.FAN;

// definimos propriedades básicas
wlAccessory
 .getService(Service.AccessoryInformation)!
   .setCharacteristic(Characteristic.Manufacturer, "WiLight")
   .setCharacteristic(Characteristic.Model, modelo)
   .setCharacteristic(Characteristic.SerialNumber, numSerie);

// esperamos pelo evento "identify" para estes acessórios
wlAccessory.on(AccessoryEventTypes.IDENTIFY, (paired: boolean, callback: VoidCallback) => {
  LIGHT_1.identify();
  callback(); // success
});

// Adicionamos os serviços Lightbulb e Fan e aguardamos por eventos de mudança do iOS.
var light1 = new Service.Lightbulb("Lampada","1light");
// @ts-ignore
wlAccessory.addService(light1)
  .getCharacteristic(Characteristic.On)!
    .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
      LIGHT_1.setPowerOn(value);
      WILIGHT.aguardaRetorno(callback);
    })
    .on(CharacteristicEventTypes.GET, (callback: NodeCallback<CharacteristicValue>) => {
      WILIGHT.solicitaDado();
      WILIGHT.aguardaRetorno(concluiGet);
      // @ts-ignore
      function concluiGet(err) {
        callback(err, LIGHT_1.powerOn);
      }
    });

var fan1 = new Service.Fan("Ventilador","1fan");
// @ts-ignore
wlAccessory.addService(fan1)
  .getCharacteristic(Characteristic.On)!
  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
    FAN_1.setPowerOn(value);
    WILIGHT.aguardaRetorno(callback);
  })
  .on(CharacteristicEventTypes.GET, (callback: NodeCallback<CharacteristicValue>) => {
    WILIGHT.solicitaDado();
    WILIGHT.aguardaRetorno(concluiGet);
    // @ts-ignore
    function concluiGet(err) {
      callback(err, FAN_1.powerOn);
    }
  });

fan1.addCharacteristic(Characteristic.RotationDirection)!
  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
    FAN_1.setDirection(value);
    WILIGHT.aguardaRetorno(callback);
  })
  .on(CharacteristicEventTypes.GET, (callback: NodeCallback<CharacteristicValue>) => {
    WILIGHT.solicitaDado();
    WILIGHT.aguardaRetorno(concluiGet);
    // @ts-ignore
    function concluiGet(err) {
      callback(err, FAN_1.direction);
    }
  });

fan1.addCharacteristic(Characteristic.RotationSpeed)!
  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
    FAN_1.setSpeed(value);
    WILIGHT.aguardaRetorno(callback);
  })
  .on(CharacteristicEventTypes.GET, (callback: NodeCallback<CharacteristicValue>) => {
    WILIGHT.solicitaDado();
    WILIGHT.aguardaRetorno(concluiGet);
    // @ts-ignore
    function concluiGet(err) {
      callback(err, FAN_1.speed);
    }
  });

// tentamos conectar...
WILIGHT.conecta();

// atualizamos estado a cada 10 segundos
setInterval(function() {
  WILIGHT.solicitaDado();
  WILIGHT.testaFalha();
}, 10000);
