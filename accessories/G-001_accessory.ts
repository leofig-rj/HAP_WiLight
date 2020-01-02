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
var modelo = "G-001";

// TCP
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
// @ts-ignore
clientTCP.on('data', function(data) {
  var ret = '' + data;
  if (ret.substr(0, 16) === '&' + numSerie + "003") {
    WILIGHT.falhas = 0;
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
var GARAGE_1 = {
  comanda: true,
  currentState: Characteristic.CurrentDoorState.CLOSED,
  esteveIndefinido: true,

  // @ts-ignore
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
    // mando abrir… na realidade tanto faz abrir ou fechar
    garage1.setCharacteristic(Characteristic.TargetDoorState, Characteristic.TargetDoorState.OPEN);
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
wlAccessory.category = Categories.GARAGE_DOOR_OPENER;

// definimos propriedades básicas
wlAccessory
  .getService(Service.AccessoryInformation)!
    .setCharacteristic(Characteristic.Manufacturer, "WiLight")
    .setCharacteristic(Characteristic.Model, modelo)
    .setCharacteristic(Characteristic.SerialNumber, numSerie);

// esperamos pelo evento "identify" para estes acessórios
wlAccessory.on(AccessoryEventTypes.IDENTIFY, (paired: boolean, callback: VoidCallback) => {
  GARAGE_1.identify();
  callback(); // success
});

// Adicionamos o serviço GarageDoorOpener e aguardamos por eventos de mudança do iOS.
var garage1 = new Service.GarageDoorOpener("Portao de Garagem","1garage");
// @ts-ignore
wlAccessory.addService(garage1)
  .getCharacteristic(Characteristic.TargetDoorState)!
    .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
      GARAGE_1.setTarget(value);
      WILIGHT.aguardaRetorno(callback);
    });

garage1.getCharacteristic(Characteristic.CurrentDoorState)!
  .on(CharacteristicEventTypes.GET, (callback: NodeCallback<CharacteristicValue>) => {
    WILIGHT.solicitaDado();
    WILIGHT.aguardaRetorno(concluiGet);
    // @ts-ignore
    function concluiGet(err) {
      callback(err, GARAGE_1.currentState);
    }
  });

// tentamos conectar...
WILIGHT.conecta();

// atualizamos estado a cada 10 segundos
setInterval(function() {
  WILIGHT.solicitaDado();
  WILIGHT.testaFalha();
}, 10000);
