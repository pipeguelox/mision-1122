// Datos fijos de la app: nombres de municipios, subregiones y colores.
// Cada municipio se identifica con su código DANE (ej. Medellín = 05001).

const NOMBRES = {
  "05001":"Medellín","05002":"Abejorral","05004":"Abriaquí","05021":"Alejandría","05030":"Amagá",
  "05031":"Amalfi","05034":"Andes","05036":"Angelópolis","05038":"Angostura","05040":"Anorí",
  "05042":"Santa Fe de Antioquia","05044":"Anzá","05045":"Apartadó","05051":"Arboletes","05055":"Argelia",
  "05059":"Armenia","05079":"Barbosa","05086":"Belmira","05088":"Bello","05091":"Betania",
  "05093":"Betulia","05101":"Ciudad Bolívar","05107":"Briceño","05113":"Buriticá","05120":"Cáceres",
  "05125":"Caicedo","05129":"Caldas","05134":"Campamento","05138":"Cañasgordas","05142":"Caracolí",
  "05145":"Caramanta","05147":"Carepa","05148":"El Carmen de Viboral","05150":"Carolina del Príncipe","05154":"Caucasia",
  "05172":"Chigorodó","05190":"Cisneros","05197":"Cocorná","05206":"Concepción","05209":"Concordia",
  "05212":"Copacabana","05234":"Dabeiba","05237":"Donmatías","05240":"Ebéjico","05250":"El Bagre",
  "05264":"Entrerríos","05266":"Envigado","05282":"Fredonia","05284":"Frontino","05306":"Giraldo",
  "05308":"Girardota","05310":"Gómez Plata","05313":"Granada","05315":"Guadalupe","05318":"Guarne",
  "05321":"Guatapé","05347":"Heliconia","05353":"Hispania","05360":"Itagüí","05361":"Ituango",
  "05364":"Jardín","05368":"Jericó","05376":"La Ceja","05380":"La Estrella","05390":"La Pintada",
  "05400":"La Unión","05411":"Liborina","05425":"Maceo","05440":"Marinilla","05467":"Montebello",
  "05475":"Murindó","05480":"Mutatá","05483":"Nariño","05490":"Necoclí","05495":"Nechí",
  "05501":"Olaya","05541":"El Peñol","05543":"Peque","05576":"Pueblorrico","05579":"Puerto Berrío",
  "05585":"Puerto Nare","05591":"Puerto Triunfo","05604":"Remedios","05607":"El Retiro","05615":"Rionegro",
  "05628":"Sabanalarga","05631":"Sabaneta","05642":"Salgar","05647":"San Andrés de Cuerquia","05649":"San Carlos",
  "05652":"San Francisco","05656":"San Jerónimo","05658":"San José de la Montaña","05659":"San Juan de Urabá","05660":"San Luis",
  "05664":"San Pedro de los Milagros","05665":"San Pedro de Urabá","05667":"San Rafael","05670":"San Roque","05674":"San Vicente Ferrer",
  "05679":"Santa Bárbara","05686":"Santa Rosa de Osos","05690":"Santo Domingo","05697":"El Santuario","05736":"Segovia",
  "05756":"Sonsón","05761":"Sopetrán","05789":"Támesis","05790":"Tarazá","05792":"Tarso",
  "05809":"Titiribí","05819":"Toledo","05837":"Turbo","05842":"Uramita","05847":"Urrao",
  "05854":"Valdivia","05856":"Valparaíso","05858":"Vegachí","05861":"Venecia","05873":"Vigía del Fuerte",
  "05885":"Yalí","05887":"Yarumal","05890":"Yolombó","05893":"Yondó","05895":"Zaragoza"
};

// Las 9 subregiones de Antioquia, con su color y sus municipios.
const SUBREGIONES = [
  { id:"aburra",    nombre:"Valle de Aburrá",  color:"#E4572E",
    codigos:"05001 05079 05088 05129 05212 05266 05308 05360 05380 05631" },
  { id:"norte",     nombre:"Norte",            color:"#2E86AB",
    codigos:"05038 05086 05107 05134 05150 05237 05264 05310 05315 05361 05647 05658 05664 05686 05819 05854 05887" },
  { id:"nordeste",  nombre:"Nordeste",         color:"#7B2D8E",
    codigos:"05031 05040 05190 05604 05670 05690 05736 05858 05885 05890" },
  { id:"oriente",   nombre:"Oriente",          color:"#3BA55C",
    codigos:"05002 05021 05055 05148 05197 05206 05313 05318 05321 05376 05400 05440 05483 05541 05607 05615 05649 05652 05660 05667 05674 05697 05756" },
  { id:"suroeste",  nombre:"Suroeste",         color:"#D4A017",
    codigos:"05030 05034 05036 05091 05093 05145 05101 05209 05282 05353 05364 05368 05390 05467 05576 05642 05679 05789 05792 05809 05847 05856 05861" },
  { id:"occidente", nombre:"Occidente",        color:"#C2185B",
    codigos:"05004 05044 05059 05113 05125 05138 05234 05240 05284 05306 05347 05411 05501 05543 05628 05656 05042 05761 05842" },
  { id:"uraba",     nombre:"Urabá",            color:"#00897B",
    codigos:"05045 05051 05147 05172 05475 05480 05490 05659 05665 05837 05873" },
  { id:"bajocauca", nombre:"Bajo Cauca",       color:"#F57C00",
    codigos:"05120 05154 05250 05495 05790 05895" },
  { id:"magdalena", nombre:"Magdalena Medio",  color:"#5C6BC0",
    codigos:"05142 05425 05579 05585 05591 05893" }
];
SUBREGIONES.forEach(s => s.codigos = s.codigos.split(" "));

// Busca la subregión de un municipio
const SUBREGION_DE = {};
SUBREGIONES.forEach(s => s.codigos.forEach(c => SUBREGION_DE[c] = s));

const TOTAL_MUNICIPIOS = Object.keys(NOMBRES).length; // 125
