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
// @ts-ignore
clientTCP.on('data', function(data) {
  var ret = '' + data;
  if(ret.substr(0, 16) === '&' + numSerie + "065") {
    WILIGHT.falhas = 0;
    // sinalizo retorno
    WILIGHT.retorno = true;
    // atualizo estados...
    // @ts-ignore
    var targetPosition = ~~(ret.substr(24, 3) * 100 / 255); // uso ~~para converter para inteiro!
    // @ts-ignore
    var currentPosition = ~~(ret.substr(27, 3) * 100 / 255); // uso ~~para converter para inteiro!
    // @ts-ignore
    var positionState = ~~(ret.substr(23, 1)); // uso ~~para converter para inteiro!
    WIN_COVERING_1.comanda = false;
    if (positionState==Characteristic.PositionState.STOPPED) {
      covering1.setCharacteristic(Characteristic.TargetPosition, currentPosition);
      covering1.setCharacteristic(Characteristic.CurrentPosition, currentPosition);
      covering1.setCharacteristic(Characteristic.PositionState, positionState);
    } else {
      covering1.setCharacteristic(Characteristic.TargetPosition, targetPosition);
//      covering1.setCharacteristic(Characteristic.CurrentPosition, currentPosition);
      covering1.setCharacteristic(Characteristic.PositionState, positionState);
    }
    WIN_COVERING_1.comanda = true;
  };
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
var WIN_COVERING_1 = {
  comanda: true,
  currentPosition: 50, // percentage
  targetPosition: 50,  // percentage
  positionState: Characteristic.PositionState.STOPPED,

  // @ts-ignore
  setTarget: function(targetPosition) {
    WIN_COVERING_1.targetPosition = targetPosition;
    if (WIN_COVERING_1.comanda) {
      // @ts-ignore
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
      cmd = cmd;
      WILIGHT.enviaComando("007003" + cmd);
    };
  },
  // @ts-ignore
  setState: function(positionState) {
    WIN_COVERING_1.positionState = positionState;
    if (WIN_COVERING_1.comanda) {
      if (positionState = Characteristic.PositionState.INCREASING) {
        WILIGHT.enviaComando("001000");
      } else if (positionState = Characteristic.PositionState.DECREASING) {
        WILIGHT.enviaComando("002000");
      } else if (positionState = Characteristic.PositionState.STOPPED) {
        WILIGHT.enviaComando("003000");
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
var wlUUID = uuid.generate(aux);

// Este é o acessório que retornará para o HAP-NodeJS que representa o nosso WiLight.
var wlAccessory = exports.accessory = new Accessory("WiLight " + numSerie.substr(6), wlUUID);

// adicionamos propriedades para publicar usando Core.ts
// @ts-ignore
wlAccessory.username = mac;
// @ts-ignore
wlAccessory.pincode = "031-45-154";
// @ts-ignore
wlAccessory.category = Categories.WINDOW_COVERING;

// definimos propriedades básicas
wlAccessory
  .getService(Service.AccessoryInformation)!
    .setCharacteristic(Characteristic.Manufacturer, "WiLight")
    .setCharacteristic(Characteristic.Model, modelo)
    .setCharacteristic(Characteristic.SerialNumber, numSerie);

// esperamos pelo evento "identify" para estes acessórios
wlAccessory.on(AccessoryEventTypes.IDENTIFY, (paired: boolean, callback: VoidCallback) => {
  WIN_COVERING_1.identify();
  callback(); // success
});

// Adicionamos os serviços WindowCovering e aguardamos por eventos de mudança do iOS.
var covering1 = new Service.WindowCovering("Cortina", "1cortina");
// @ts-ignore
wlAccessory.addService(covering1);

covering1.getCharacteristic(Characteristic.TargetPosition)!
  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
    WIN_COVERING_1.setTarget(value);
    WILIGHT.aguardaRetorno(callback);
  });

//covering1.getCharacteristic(Characteristic.CurrentPosition)!
//  .on(CharacteristicEventTypes.GET, (callback: NodeCallback<CharacteristicValue>) => {
//    WILIGHT.solicitaDado();
//    WILIGHT.aguardaRetorno(concluiGet);
//    // @ts-ignore
//    function concluiGet(err) {
//      callback(err, WIN_COVERING_1.currentPosition);
//    }
//});

covering1.getCharacteristic(Characteristic.PositionState)!
  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
    WIN_COVERING_1.setState(value);
    WILIGHT.aguardaRetorno(callback);
  })
  .on(CharacteristicEventTypes.GET, (callback: NodeCallback<CharacteristicValue>) => {
    WILIGHT.solicitaDado();
    WILIGHT.aguardaRetorno(concluiGet);
    // @ts-ignore
    function concluiGet(err) {
      callback(err, WIN_COVERING_1.positionState);
    }
  });

// tentamos conectar...
WILIGHT.conecta();

// atualizamos estado a cada 10 segundos
setInterval(function() {
  WILIGHT.solicitaDado();
  WILIGHT.testaFalha();
}, 10000);
