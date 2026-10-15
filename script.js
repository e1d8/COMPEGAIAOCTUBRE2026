// La mateixa configuració pública i col·lecció que utilitza el formulari.
const firebaseConfig = {
  apiKey: 'AIzaSyAvXaeDAdu3R_Yufb-CjwEypjjJR_xcvcc',
  authDomain: 'compe-gaia-octubre-2026.firebaseapp.com',
  projectId: 'compe-gaia-octubre-2026',
  storageBucket: 'compe-gaia-octubre-2026.firebasestorage.app',
  messagingSenderId: '575564173083',
  appId: '1:575564173083:web:76820b5d7287db51fe4dbe'
};

const RESULTATS_PER_PAGINA = 5;
const DURACIO_RECOMPTE = 900;
const DURACIO_FILA_RANQUING = 320;
const INTERVAL_FILA_RANQUING = 100;
const LLAVOR_BLOBS = String(Date.now());
const CATEGORIES = ['General', 'Femení', 'Masculí'];

const PROBLEMES = Array.from({ length: 17 }, (_, index) => ({
  camp: `bloque${index + 1}`,
  etiqueta: `Bloc ${index + 1}`,
  zona: 10,
  top: 25
}));

const PAGINES_GRAFIC = Array.from(
  { length: Math.ceil(PROBLEMES.length / 4) },
  (_, index) => PROBLEMES.slice(index * 4, index * 4 + 4)
);

const elements = {
  estatCarrega: document.getElementById('estat-carrega'),
  indicadorCarrega: document.getElementById('indicador-carrega'),
  textEstat: document.getElementById('text-estat'),
  reintentar: document.getElementById('reintentar'),
  contingut: document.getElementById('contingut'),
  senseResultats: document.getElementById('sense-resultats'),
  pestanyes: [...document.querySelectorAll('[role="tab"]')],
  panellRanquing: document.getElementById('panell-ranquing'),
  cosRanquing: document.getElementById('cos-ranquing'),
  paginaRanquing: document.getElementById('pagina-ranquing'),
  ranquingAnterior: document.getElementById('ranquing-anterior'),
  ranquingSeguent: document.getElementById('ranquing-seguent'),
  resumEstadistiques: document.getElementById('resum-estadistiques'),
  totalParticipants: document.getElementById('total-participants'),
  etiquetaParticipants: document.getElementById('etiqueta-participants'),
  puntuacioMitjana: document.getElementById('puntuacio-mitjana'),
  etiquetaMitjana: document.getElementById('etiqueta-mitjana'),
  anunciCanvis: document.getElementById('anunci-canvis')
};

function creaEstatGrafic(sufix, titol, unitat) {
  return {
    titol, unitat,
    esIntents: sufix === '-intents',
    pagina: 0,
    versioAnimacio: 0,
    observador: null,
    visible: false,
    grafic: document.getElementById(`grafic${sufix}`),
    maximEscala: document.getElementById(`maxim-escala${sufix}`),
    descripcio: document.getElementById(`descripcio-grafic${sufix}`),
    indicador: document.getElementById(`pagina-grafic${sufix}`),
    anterior: document.getElementById(`grafic${sufix}-anterior`),
    seguent: document.getElementById(`grafic${sufix}-seguent`)
  };
}

const graficPuntuacio = creaEstatGrafic('', 'Puntuació per bloc', 'participants');
const graficIntents = creaEstatGrafic('-intents', 'Intents per bloc', 'intents');
const grafics = [graficPuntuacio, graficIntents];

const formatEnter = new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 0 });
const ordenaNoms = new Intl.Collator('ca-ES', { sensitivity: 'base', numeric: true });

let resultats = [];
let firebaseClientPromise = null;
let carregant = false;
let categoriaActual = 'General';
let paginaRanquingActual = 0;
let versioAnimacioEstadistiques = 0;
let observadorEstadistiques = null;
let versioAnimacioRanquing = 0;

function normalitzaResultat(fila) {
  const resultat = {
    id: String(fila.id ?? ''),
    dorsal: String(fila.dorsal ?? fila.id ?? ''),
    anonimo: fila.anonimo === true,
    nombre: String(fila.nombre ?? ''),
    genero: String(fila.genero ?? ''),
    // Un valor desconegut no és zero: no l’incloem en la suma d’intents.
    intentos: Array.from({ length: PROBLEMES.length }, (_, index) => {
      const valor = Array.isArray(fila.intentos) ? fila.intentos[index] : null;
      return Number.isInteger(valor) && valor >= 0 && valor <= 99 ? valor : null;
    }),
    total: Number(fila.total) || 0
  };
  for (const problema of PROBLEMES) {
    resultat[problema.camp] = Number(fila[problema.camp]) || 0;
  }
  return resultat;
}

async function lligResultats() {
  if (navigator.onLine === false) throw new TypeError('Sense connexió.');
  if (!firebaseClientPromise) {
    firebaseClientPromise = Promise.all([
      import('https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore-lite.js')
    ]).then(([appSdk, firestoreSdk]) => {
      const app = appSdk.initializeApp(firebaseConfig);
      return { ...firestoreSdk, db: firestoreSdk.getFirestore(app) };
    }).catch(error => {
      firebaseClientPromise = null;
      throw error;
    });
  }

  const { db, collection, getDocs } = await firebaseClientPromise;
  const consulta = await getDocs(collection(db, 'resultados'));
  return consulta.docs.map(document => normalitzaResultat({
    ...document.data(),
    id: document.id
  }));
}

function filtraCategoria(categoria) {
  if (categoria === 'General') return [...resultats];
  return resultats.filter(resultat => resultat.genero === categoria);
}

function calculaRanquing(categoria) {
  const ordenats = filtraCategoria(categoria).sort((a, b) =>
    b.total - a.total ||
    ordenaNoms.compare(a.nombre, b.nombre) ||
    a.id.localeCompare(b.id)
  );

  let puntuacioAnterior = null;
  let posicio = 0;
  return ordenats.map(resultat => {
    if (puntuacioAnterior === null || resultat.total !== puntuacioAnterior) {
      posicio += 1;
      puntuacioAnterior = resultat.total;
    }
    return { ...resultat, posicio };
  });
}

function creaCelda(text, classe) {
  const celda = document.createElement('td');
  if (classe) celda.className = classe;
  celda.textContent = text;
  return celda;
}

function hashText(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function creaGenerador(seedInicial) {
  let seed = seedInicial || 1;
  return () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
}

function creaBlobRanquing(resultat) {
  const blob = document.createElement('span');
  blob.className = `blob-ranquing blob-posicio-${resultat.posicio}`;
  blob.setAttribute('aria-hidden', 'true');
  blob.style.setProperty('--retard-pop-blob', `${(resultat.posicio - 1) * 140}ms`);

  const forma = document.createElement('span');
  forma.className = 'forma-blob';

  const aleatori = creaGenerador(hashText(`${LLAVOR_BLOBS}-${resultat.id}-${resultat.posicio}`));
  function creaForma() {
    const radis = Array.from({ length: 8 }, () => `${Math.round(15 + aleatori() * 70)}%`);
    return `${radis.slice(0, 4).join(' ')} / ${radis.slice(4).join(' ')}`;
  }

  for (const variant of ['a', 'b', 'c', 'd']) {
    forma.style.setProperty(`--forma-blob-${variant}`, creaForma());
    forma.style.setProperty(`--gir-blob-${variant}`, `${Math.round(-18 + aleatori() * 36)}deg`);
    forma.style.setProperty(`--escala-x-blob-${variant}`, (0.85 + aleatori() * 0.3).toFixed(2));
    forma.style.setProperty(`--escala-y-blob-${variant}`, (0.85 + aleatori() * 0.3).toFixed(2));
  }
  forma.style.setProperty('--retard-blob', `${(-aleatori() * 9).toFixed(2)}s`);
  blob.append(forma);
  return blob;
}

function animaRanquing() {
  versioAnimacioRanquing += 1;
  const versio = versioAnimacioRanquing;
  const files = [...elements.cosRanquing.querySelectorAll('.fila-ranquing')];
  elements.cosRanquing.classList.remove('ranquing-animat', 'blobs-ranquing-visibles');

  files.forEach((fila, index) => {
    fila.style.setProperty('--retard-fila', `${index * INTERVAL_FILA_RANQUING}ms`);
  });

  const redueixMoviment = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (redueixMoviment || files.length === 0) {
    elements.cosRanquing.classList.add('ranquing-animat', 'blobs-ranquing-visibles');
    return;
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (versio !== versioAnimacioRanquing) return;
      elements.cosRanquing.classList.add('ranquing-animat');
      const duracioFiles = DURACIO_FILA_RANQUING + (files.length - 1) * INTERVAL_FILA_RANQUING;
      setTimeout(() => {
        if (versio === versioAnimacioRanquing) {
          elements.cosRanquing.classList.add('blobs-ranquing-visibles');
        }
      }, duracioFiles);
    });
  });
}

function creaCeldaPuntuacio(resultat) {
  const celda = document.createElement('td');
  const contingut = document.createElement('span');
  contingut.className = 'contingut-puntuacio';

  if (resultat.posicio >= 1 && resultat.posicio <= 3) {
    contingut.append(creaBlobRanquing(resultat));
  }

  const puntuacio = document.createElement('span');
  puntuacio.textContent = String(resultat.total);
  contingut.append(puntuacio);
  celda.append(contingut);
  return celda;
}

function renderitzaRanquing(anuncia = false) {
  const ranquing = calculaRanquing(categoriaActual);
  const totalPagines = Math.ceil(ranquing.length / RESULTATS_PER_PAGINA);
  paginaRanquingActual = totalPagines === 0
    ? 0
    : Math.min(paginaRanquingActual, totalPagines - 1);

  elements.cosRanquing.replaceChildren();

  if (ranquing.length === 0) {
    const fila = document.createElement('tr');
    fila.className = 'fila-buida';
    const celda = creaCelda('Encara no hi ha participants en esta categoria.');
    celda.colSpan = 3;
    fila.append(celda);
    elements.cosRanquing.append(fila);
  } else {
    const inici = paginaRanquingActual * RESULTATS_PER_PAGINA;
    const pagina = ranquing.slice(inici, inici + RESULTATS_PER_PAGINA);
    for (const resultat of pagina) {
      const fila = document.createElement('tr');
      fila.className = 'fila-ranquing';
      fila.append(creaCelda(String(resultat.posicio)));

      const celdaNom = document.createElement('td');
      const nom = document.createElement('span');
      nom.className = 'nom-participant';
      nom.textContent = resultat.nombre;
      nom.title = resultat.nombre;
      celdaNom.append(nom);
      fila.append(celdaNom, creaCeldaPuntuacio(resultat));
      elements.cosRanquing.append(fila);
    }
  }

  animaRanquing();

  const paginaVisible = totalPagines === 0 ? 0 : paginaRanquingActual + 1;
  elements.paginaRanquing.textContent = `${paginaVisible}/${totalPagines}`;
  elements.paginaRanquing.setAttribute('aria-label', `Pàgina ${paginaVisible} de ${totalPagines}`);
  elements.ranquingAnterior.disabled = paginaRanquingActual <= 0;
  elements.ranquingSeguent.disabled = totalPagines === 0 || paginaRanquingActual >= totalPagines - 1;
  elements.panellRanquing.setAttribute('aria-label', `Rànquing ${categoriaActual}`);
  elements.panellRanquing.querySelector('caption').textContent = `Classificació de la categoria ${categoriaActual}`;

  if (anuncia) {
    elements.anunciCanvis.textContent = `${categoriaActual}. Pàgina ${paginaVisible} de ${totalPagines}.`;
  }
}

function seleccionaCategoria(categoria, mouFocus = false) {
  if (!CATEGORIES.includes(categoria)) return;
  categoriaActual = categoria;
  paginaRanquingActual = 0;

  for (const pestanya of elements.pestanyes) {
    const activa = pestanya.dataset.categoria === categoria;
    pestanya.setAttribute('aria-selected', String(activa));
    pestanya.tabIndex = activa ? 0 : -1;
    if (activa) {
      elements.panellRanquing.setAttribute('aria-labelledby', pestanya.id);
      if (mouFocus) pestanya.focus();
    }
  }
  renderitzaRanquing(true);
}

function calculaProblema(problema) {
  let zones = 0;
  let tops = 0;
  for (const resultat of resultats) {
    const puntuacio = resultat[problema.camp];
    if (puntuacio === problema.zona) zones += 1;
    if (puntuacio === problema.top) tops += 1;
  }
  return { ...problema, zones, tops, total: zones + tops };
}

function calculaIntentsProblema(problema, index) {
  let zones = 0;
  let tops = 0;
  let sensePuntuacio = 0;
  for (const resultat of resultats) {
    const intents = resultat.intentos[index];
    if (intents === null) continue;
    const puntuacio = resultat[problema.camp];
    if (puntuacio === problema.top) tops += intents;
    else if (puntuacio === problema.zona) zones += intents;
    else if (puntuacio === 0) sensePuntuacio += intents;
  }
  return { ...problema, zones, tops, sensePuntuacio, total: zones + tops + sensePuntuacio };
}

function actualitzaEstatIntents() {
  const estat = document.getElementById('estat-intents');
  const disponibles = resultats.reduce((total, resultat) =>
    total + resultat.intentos.filter(valor => valor !== null).length, 0);
  estat.textContent = disponibles === 0
    ? 'Encara no hi ha dades d’intents.'
    : '';
  estat.hidden = !estat.textContent;
}

function animaBarresGrafic(estat) {
  estat.versioAnimacio += 1;
  const versio = estat.versioAnimacio;
  estat.grafic.classList.remove('grafic-animat');

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (versio === estat.versioAnimacio) {
        estat.grafic.classList.add('grafic-animat');
      }
    });
  });
}

function preparaAnimacioInicialGrafic(estat) {
  estat.versioAnimacio += 1;
  estat.visible = false;
  estat.grafic.classList.remove('grafic-animat');
  if (estat.observador) {
    estat.observador.disconnect();
    estat.observador = null;
  }

  function iniciaAnimacio() {
    estat.visible = true;
    animaBarresGrafic(estat);
  }

  if (!('IntersectionObserver' in window)) {
    requestAnimationFrame(iniciaAnimacio);
    return;
  }

  const observador = new IntersectionObserver(entrades => {
    if (!entrades.some(entrada => entrada.isIntersecting)) return;
    observador.disconnect();
    if (estat.observador === observador) estat.observador = null;
    iniciaAnimacio();
  }, { threshold: 0.9 });
  estat.observador = observador;
  observador.observe(estat.grafic);
}

function creaBarra(dades, maxim, esIntents = false) {
  const item = document.createElement('div');
  item.className = 'barra-item';
  item.setAttribute('role', 'listitem');
  item.setAttribute(
    'aria-label',
    esIntents
      ? `${dades.etiqueta}: intents mínims registrats. Top: ${dades.tops}, Zona: ${dades.zones}, Sense puntuació: ${dades.sensePuntuacio}. Total: ${dades.total} intents.`
      : `${dades.etiqueta}: ${dades.zones} en zona, ${dades.tops} en top, ${dades.total} en total.`
  );

  const area = document.createElement('div');
  area.className = 'barra-area';
  const escala = document.createElement('div');
  escala.className = 'barra-escala';

  const percentatge = maxim > 0 ? (dades.total / maxim) * 100 : 0;
  item.style.setProperty('--altura-barra', `${percentatge}%`);
  const total = document.createElement('span');
  total.className = 'total-barra';
  total.textContent = String(dades.total);
  total.setAttribute('aria-hidden', 'true');

  const barra = document.createElement('div');
  barra.className = 'barra-apilada';

  const segments = [
    { nom: 'Top', classe: 'top', valor: dades.tops },
    { nom: 'Zona', classe: 'zona', valor: dades.zones }
  ];
  if (esIntents) segments.push({ nom: 'Sense puntuació', classe: 'sense', valor: dades.sensePuntuacio });
  for (const dadesSegment of segments) {
    if (dadesSegment.valor === 0) continue;
    const segment = document.createElement('button');
    segment.type = 'button';
    segment.className = `segment segment-${esIntents ? 'intents-' : ''}${dadesSegment.classe}`;
    segment.style.flexGrow = String(dadesSegment.valor);
    segment.setAttribute('aria-label',
      `${dades.etiqueta}, ${dadesSegment.nom}: ${dadesSegment.valor}${esIntents ? ' intents mínims registrats' : ''}`);
    const valor = document.createElement('span');
    valor.className = 'valor-segment';
    valor.textContent = String(dadesSegment.valor);
    segment.append(valor);
    barra.append(segment);
  }

  escala.append(total, barra);
  area.append(escala);

  const etiqueta = document.createElement('span');
  etiqueta.className = 'etiqueta-barra';
  etiqueta.textContent = dades.etiqueta;

  item.append(area, etiqueta);
  return item;
}

function renderitzaGrafic(anuncia = false, estat = graficPuntuacio) {
  const dades = PROBLEMES.map((problema, index) => estat.esIntents
    ? calculaIntentsProblema(problema, index) : calculaProblema(problema));
  const maxim = estat.esIntents ? Math.max(0, ...dades.map(bloc => bloc.total)) : resultats.length;
  const pagina = dades.slice(estat.pagina * 4, estat.pagina * 4 + 4);
  estat.grafic.replaceChildren(...pagina.map(bloc => creaBarra(bloc, maxim, estat.esIntents)));
  estat.maximEscala.textContent = String(maxim);
  estat.indicador.textContent = `${estat.pagina + 1}/${PAGINES_GRAFIC.length}`;
  estat.indicador.setAttribute('aria-label', `Pàgina ${estat.pagina + 1} de ${PAGINES_GRAFIC.length}`);
  estat.anterior.disabled = estat.pagina === 0;
  estat.seguent.disabled = estat.pagina === PAGINES_GRAFIC.length - 1;
  estat.descripcio.textContent =
    `Gràfic de barres apilades, amb una escala comuna de 0 a ${maxim} ${estat.unitat}. ` +
    `Pàgina ${estat.pagina + 1} de ${PAGINES_GRAFIC.length}.`;

  if (anuncia) {
    elements.anunciCanvis.textContent =
      `${estat.titol}. Pàgina ${estat.pagina + 1} de ${PAGINES_GRAFIC.length}.`;
  }
  if (estat.visible) animaBarresGrafic(estat);
}

function animaNumero(element, valorFinal, versio) {
  const redueixMoviment = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (redueixMoviment || valorFinal === 0) {
    element.textContent = formatEnter.format(valorFinal);
    return Promise.resolve();
  }

  element.textContent = '0';
  const inici = performance.now();

  return new Promise(resolve => {
    function actualitza(ara) {
      if (versio !== versioAnimacioEstadistiques) {
        resolve();
        return;
      }

      const progres = Math.min((ara - inici) / DURACIO_RECOMPTE, 1);
      const suavitzat = 1 - Math.pow(1 - progres, 3);
      const valorActual = Math.round(valorFinal * suavitzat);
      element.textContent = formatEnter.format(valorActual);

      if (progres < 1) {
        requestAnimationFrame(actualitza);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(actualitza);
  });
}

function animaEstadistica(element, etiqueta, valorFinal, versio) {
  animaNumero(element, valorFinal, versio);
  setTimeout(() => {
    if (versio === versioAnimacioEstadistiques) {
      etiqueta.classList.add('etiqueta-visible');
    }
  }, 300);
}

function preparaAnimacioEstadistiques(total, mitjana) {
  versioAnimacioEstadistiques += 1;
  const versio = versioAnimacioEstadistiques;

  if (observadorEstadistiques) {
    observadorEstadistiques.disconnect();
    observadorEstadistiques = null;
  }

  elements.totalParticipants.textContent = '0';
  elements.puntuacioMitjana.textContent = '0';
  elements.etiquetaParticipants.classList.remove('etiqueta-visible');
  elements.etiquetaMitjana.classList.remove('etiqueta-visible');

  function iniciaAnimacio() {
    animaEstadistica(elements.totalParticipants, elements.etiquetaParticipants, total, versio);
    animaEstadistica(elements.puntuacioMitjana, elements.etiquetaMitjana, mitjana, versio);
  }

  if (!('IntersectionObserver' in window)) {
    iniciaAnimacio();
    return;
  }

  const observador = new IntersectionObserver(entrades => {
    if (!entrades.some(entrada => entrada.isIntersecting)) return;
    observador.disconnect();
    if (observadorEstadistiques === observador) observadorEstadistiques = null;
    iniciaAnimacio();
  }, { threshold: 0.8 });
  observadorEstadistiques = observador;
  observador.observe(elements.resumEstadistiques);
}

function renderitzaEstadistiques() {
  const total = resultats.length;
  const suma = resultats.reduce((acumulat, resultat) => acumulat + resultat.total, 0);
  const mitjana = total > 0 ? Math.round(suma / total) : 0;
  preparaAnimacioEstadistiques(total, mitjana);
  actualitzaEstatIntents();
  for (const estat of grafics) {
    preparaAnimacioInicialGrafic(estat);
    renderitzaGrafic(false, estat);
  }
}

function renderitzaTot() {
  elements.senseResultats.hidden = resultats.length !== 0;
  renderitzaRanquing();
  renderitzaEstadistiques();
}

function mostraCarrega() {
  elements.contingut.hidden = true;
  elements.estatCarrega.hidden = false;
  elements.estatCarrega.classList.add('estat-carrega-actiu');
  elements.estatCarrega.classList.remove('missatge-error');
  elements.estatCarrega.setAttribute('aria-busy', 'true');
  elements.indicadorCarrega.hidden = false;
  elements.textEstat.classList.add('visually-hidden');
  elements.textEstat.textContent = 'Carregant resultats…';
  elements.reintentar.hidden = true;
}

function mostraError(error) {
  console.error('No s’han pogut carregar els resultats:', error);
  elements.estatCarrega.classList.remove('estat-carrega-actiu');
  elements.estatCarrega.classList.add('missatge-error');
  elements.estatCarrega.removeAttribute('aria-busy');
  elements.indicadorCarrega.hidden = true;
  elements.textEstat.classList.remove('visually-hidden');
  switch (error?.code) {
    case 'permission-denied':
      elements.textEstat.textContent = 'No es poden consultar els resultats. Avisa l’organització perquè revise els permisos.';
      break;
    case 'resource-exhausted':
      elements.textEstat.textContent = 'S’ha arribat al límit d’ús de la base de dades. Avisa l’organització.';
      break;
    case 'invalid-argument':
    case 'failed-precondition':
    case 'not-found':
    case 'app/invalid-api-key':
      elements.textEstat.textContent = 'No s’ha pogut accedir a la base de dades. Avisa l’organització perquè revise la configuració.';
      break;
    default:
      elements.textEstat.textContent = 'No s’han pogut carregar els resultats. Comprova la connexió i torna-ho a provar.';
  }
  elements.reintentar.hidden = false;
}

async function carrega() {
  if (carregant) return;
  carregant = true;
  mostraCarrega();
  try {
    resultats = await lligResultats();
    paginaRanquingActual = 0;
    for (const estat of grafics) estat.pagina = 0;
    renderitzaTot();
    elements.estatCarrega.hidden = true;
    elements.estatCarrega.removeAttribute('aria-busy');
    elements.contingut.hidden = false;
  } catch (error) {
    mostraError(error);
  } finally {
    carregant = false;
  }
}

for (const pestanya of elements.pestanyes) {
  pestanya.addEventListener('click', () => seleccionaCategoria(pestanya.dataset.categoria));
  pestanya.addEventListener('keydown', event => {
    const index = CATEGORIES.indexOf(pestanya.dataset.categoria);
    let nouIndex = null;
    if (event.key === 'ArrowRight') nouIndex = (index + 1) % CATEGORIES.length;
    if (event.key === 'ArrowLeft') nouIndex = (index - 1 + CATEGORIES.length) % CATEGORIES.length;
    if (event.key === 'Home') nouIndex = 0;
    if (event.key === 'End') nouIndex = CATEGORIES.length - 1;
    if (nouIndex !== null) {
      event.preventDefault();
      seleccionaCategoria(CATEGORIES[nouIndex], true);
    }
  });
}

elements.ranquingAnterior.addEventListener('click', () => {
  if (paginaRanquingActual > 0) {
    paginaRanquingActual -= 1;
    renderitzaRanquing(true);
  }
});

elements.ranquingSeguent.addEventListener('click', () => {
  const totalPagines = Math.ceil(calculaRanquing(categoriaActual).length / RESULTATS_PER_PAGINA);
  if (paginaRanquingActual < totalPagines - 1) {
    paginaRanquingActual += 1;
    renderitzaRanquing(true);
  }
});

for (const estat of grafics) {
  estat.anterior.addEventListener('click', () => {
    if (estat.pagina > 0) {
      estat.pagina -= 1;
      renderitzaGrafic(true, estat);
    }
  });
  estat.seguent.addEventListener('click', () => {
    if (estat.pagina < PAGINES_GRAFIC.length - 1) {
      estat.pagina += 1;
      renderitzaGrafic(true, estat);
    }
  });
  estat.grafic.addEventListener('click', event => {
    const segment = event.target.closest('.segment');
    if (!segment) return;
    const jaEstavaActiu = segment.classList.contains('segment-actiu');
    for (const segmentActiu of estat.grafic.querySelectorAll('.segment-actiu')) {
      segmentActiu.classList.remove('segment-actiu');
    }
    if (!jaEstavaActiu) segment.classList.add('segment-actiu');
  });
}

elements.reintentar.addEventListener('click', carrega);

carrega();
