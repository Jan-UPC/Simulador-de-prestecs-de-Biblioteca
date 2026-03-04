const express = require('express');
const app = express(); // Instància de servidor web
app.use(express.json()); // Per parsejar JSON
app.use(express.urlencoded({ extended: true })); // Permet obtenir informació dels formularis al cos de la petició HTTP
const fs = require('fs'); // Per poder llegir i escriure al fitxer de la base de dades
const path = require('path'); // Per poder fer "path.join"
const cors = require('cors'); // Permet que el servidor accepti peticions des d'altres orígens i el navegador no les bloqueji
app.use(cors()) // Use serveix per a tots els mètodes (POST, PUT, ...)
const DATABASE_PATH = path.join(__dirname, 'db.json'); // Amb "path.join" creem la ruta de la base de dades de manera segura

function read_database () {
    const content = fs.readFileSync(DATABASE_PATH, 'utf-8');
    return JSON.parse(content); // Transformem el contingut del fitxer en un objecte JSON
}

function authentication(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', ''); // Per quedar-nos només amb la cadena del token
    // Amb "?." aconseguim que es faci el replace només si "authorization" existeix, perquè en aquesta situació no es
    // llencin errors i el valor de "token" sigui "undefined"

    const db = read_database();
    const sessio = db.sessions.find(s => s.token === token);

    if (!sessio) {
        return res.status(401).json({
            errorToken: true,
            error: "No es pot iniciar sessió amb aquest token"
        });
    }

    req.usuari_id = sessio.usuari_id;
    next(); // Li passem a la següent funció de l'endpoint l'id de l'usuari corresponent a aquesta sessió
}

// ########## ENDPOINTS ##########

// USUARIS

// Permet iniciar sessió
app.post('/login', function (req, res) {
    // Utilitzem POST en comptes de GET perquè el login no és una operació de lectura, és una acció
    const db = read_database();
    const { email, contrasenya } = req.body;

    if (!email || !contrasenya) {
        return res.status(400).json({ error: 'Cal proporcionar un email i una contrasenya' });
    }

    const usuari = db.usuaris.find(u => u.email === email); // Els usuaris, a part d'identificar-se per ID, també s'identifiquen per email.
    // Si l'email o la contrasenya són incorrectes, no diem quina de les dues coses ho és per seguretat
    if (!usuari || usuari.contrasenya !== contrasenya) {
        return res.status(401).json({ error: 'Credencials incorrectes' });
    }

    const usuariResposta = { // Per seguretat no enviem la contrasenya. L'usuari l'haurà d'introduir per fer certes accions
        id: usuari.id,
        nom: usuari.nom,
        email: usuari.email
    };
    
    // Crear token
    const token = crypto.randomUUID();
    db.sessions.push({
        token: token,
        usuari_id: usuari.id
    });
    fs.writeFileSync(DATABASE_PATH, JSON.stringify(db, null, 2)); // Actualitzem la base de dades amb el nou token

    res.json({
        message: 'Sessió iniciada correctament',
        usuari: usuariResposta,
        token: token
    });
});

// Permet iniciar sessió amb un token
app.get('/sessio', authentication, function(req, res) {
    // Només s'executa aquest codi si la funció d'autenticació ha tingut èxit
    const db = read_database();
    const usuari = db.usuaris.find(u => u.id === req.usuari_id); // Mirem l'id que ha donat el token

    const usuariResposta = { // Per seguretat no enviem la contrasenya. L'usuari l'haurà d'introduir per fer certes accions
        id: usuari.id,
        nom: usuari.nom,
        email: usuari.email
    };

    res.json({
        message: 'Sessió iniciada correctament',
        usuari: usuariResposta
    });
});

// Obté tots els usuaris (NO UTILITZAT)
/*app.get('/usuaris', function (req, res) {
    const db = read_database();
    res.json(db.usuaris); // Afegeix el header "Content-Type: application/json" i envia la resposta, enviant "db.usuaris" com un string JSON
});*/

// Obté un usuari en concret (NO UTILITZAT)
/*app.get('/usuaris/:id', function (req, res) {
    const db = read_database();
    // req.params conté els paràmetres que hi ha a la ruta, i ens interessa ":id"
    const id = parseInt(req.params.id); // Transformem l'id, que és un string, en un número, perquè a la base de dades els IDs són números
    const usuari = db.usuaris.find(u => u.id === id); // Recorrem tot l'array d'usuaris fins trobar l'usuari "u" que té el mateix "id" que l'usuari
    // de la ruta

    if (!usuari) {
        return res.status(404).json({ error: 'Usuari no trobat' });
    }

    res.json(usuari);
});*/

// Obté tots els préstecs (o només els no retornats) d'un usuari en particular, amb paginació
app.get('/usuaris/:id/prestecs', authentication, function (req, res) {
    const db = read_database();
    const id = parseInt(req.params.id); // Obtenim l'identificador de l'usuari del qual volem aconseguir tots els seus préstecs

    const usuari = db.usuaris.find(u => u.id === id);
    if (!usuari) {
        // Si l'usuari no existeix a la base de dades, no podem buscar els seus préstecs
        return res.status(404).json({ error: 'Usuari no trobat' });
    }

    // Busquem tots els préstecs que estan associats a l'usuari
    let prestecsUsuari = null;
    let no_retornats = 0;
    if (req.query.no_retornats === 'true') { // Fem la comprovació amb === perquè aquest paràmetre s'envia com un string, no com un boolèa
        // Només volem els préstecs que no han sigut retornats
        prestecsUsuari = db.prestecs.filter(p => p.usuari_id === id && !p.retornat); // "filter" és com "find", però en comptes de retornar només
        // un element, retorna en un array tots elements que compleixin amb la condició que té dins
        no_retornats = prestecsUsuari.length;
    }
    else {
        prestecsUsuari = db.prestecs.filter(p => p.usuari_id === id);
        no_retornats = prestecsUsuari.filter(p => !p.retornat).length; // Necessitem saber quants préstecs té l'usuari sense retornar per mostrar-ho
        // a la seva secció de préstecs
    }

    // Limitem el nombre de préstecs visibles amb paginació
    const page = parseInt(req.query.page) || 1;
    limit = 3; // No l'enviarà el client
    const start = (page -1) * limit;
    const end = start + limit; // Posició del primer llibre que no s'agafa

    const prestecsPagina = prestecsUsuari.slice(start, end);

    res.json({
        prestecs: prestecsPagina,
        total: prestecsUsuari.length,
        no_retornats: no_retornats,
        pagina: page,
        num_pagines: Math.ceil(prestecsUsuari.length/limit) // Per exemple, si tenim un préstec, el resultat d'aquest càlcul serà 1 perquè la divisió donaria 0.2,
        // i 1 és l'enter superior immediat
    });
});

// Crea un nou usuari a partir de les dades que conté el body de la petició
app.post('/usuaris', function (req, res) {
    const {nom, email, contrasenya, confirmacio } = req.body; // Amb aquesta desestructuració, "nom" tindrà el valor de la primera propietat
    // de "req.body", "email" el valor de la segona, "contrasenya" el valor de la tercera i "confirmacio" el valor de la quarta

    if (!nom || !email || !contrasenya || !confirmacio) {
        // No es pot crear un usuari si falten un o més d'aquests paràmetres
        return res.status(400).json({ error: "Un o més d'aquests camps obligatoris no s'ha introduït: nom, email, contrasenya, confirmació de contrasenya" });
    }

    if (contrasenya !== confirmacio) {
        // L'usuari ha d'introduir la mateixa contrasenya dues vegades, en camps diferents, per confirmar que aquella
        // és la contrasenya que vol fer servir. Si la contrasenya i la confirmació no coincideixen, no es pot crear
        // el compte d'usuari
        return res.status(400).json({ error: 'La contrasenya i la confirmació no coincideixen' });
    }

    const db = read_database(); // No cal que sempre posem la lectura de la base de dades al principi de cada funció, perquè hi ha condicions
    // que es poden complir sense llegir-la que permetrien evitar lectures innecesàries
    const emailRepetit = db.usuaris.some(u => u.email === email); // "some" retorna true si algun element de la llista d'usuaris compleix la condició que té dins
    if (emailRepetit) {
        // Segons el diagama UML, els emails són UNIQUE KEY, per tant no poden haver-hi dos usuaris amb el mateix email
        return res.status(400).json({ error: 'Aquest email ja és utilitzat per un altre usuari' }); // Enviem un codi 400 Bad Request (sintaxi invàlida)
    }

    // Amb "map", agafem cada usuari de la base de dades i creem un nou array amb, només, l'identificador de cada usuari
    // Amb el spread operator "..." fem que l'array d'IDs es converteixi en arguments individuals que es passaran a "max"
    // ("max" no funciona amb arrays), i així obtenim l'identificador d'usuari més gran
    const nouId = db.usuaris.length > 0 ? Math.max(...db.usuaris.map(u => u.id)) + 1 : 1; // Si la base de dades té un usuari o més,
    // l'identificador del nou usuari serà l'identificador d'usuari més gran més 1 (no podem assignar-li, per exemple, el valor de
    // la mida de la llista, perquè això no garantitza que no es repeteixin els ids quan s'han esborrat usuaris), altrament serà 1.
    const nouUsuari = {
        id: nouId,
        nom,
        email,
        contrasenya
    };

    db.usuaris.push(nouUsuari); // Actualitzem l'objecte de la base de dades
    fs.writeFileSync(DATABASE_PATH, JSON.stringify(db, null, 2)); // Actualitzem la base de dades amb el nou usuari

    res.status(201).json(nouUsuari); // Enviem un codi 201 Created
});

// Actualitza el nom i email d'un usuari. Per poder efectuar els canvis, la contrasenya introduïda al body
// ha de ser la mateixa que la que l'usuari té a la base de dades
app.patch('/usuaris/:id', authentication, function (req, res) {
    const {nom, email, contrasenya} = req.body;

    // Comprovacions per precaució, tot i que el frontend també les farà. Els camps de nom i email han de tenir alguna
    // cosa, fins i tot quan només es modifica un dels dos camps
    if (!nom || !email) {
        return res.status(400).json({ error: 'Cal proporcionar un nom i un email' });
    }

    if (!contrasenya) {
        return res.status(400).json({ error: "No s'ha proporcionat una contrasenya. És necessària per fer les modificacions" });
    }

    const db = read_database();
    const id = parseInt(req.params.id);

    // Comprovem si l'usuari amb identificador "id" realment existeix
    const usuari = db.usuaris.find(u => u.id === id);
    if (!usuari) {
        return res.status(404).json({ error: 'Usuari no trobat' });
    }

    if (usuari.nom === nom && usuari.email === email) {
        // No hi ha res a modificar, així que evitem fer escriptures innecesàries a la base de dades
        // Enviem un 200 i no un 400 perquè podria haver passat que l'usuari simplement s'hagués confós
        // i li ha donat al botó de guardar canvis sense modificar cap camp (el camp de nom i email s'han
        // emplenat automàticament), i això és una operació que té sentit i podria passar, i no un error
        return res.status(200).json({ message: "No s'ha modificat cap camp" })
    }

    // L'usuari ha d'introduir correctament la seva contrasenya per poder efectuar els canvis
    if (usuari.contrasenya !== contrasenya) {
        return res.status(401).json({ error: "Contrasenya incorrecta. No s'han realitzat els canvis" }); // Enviem un codi 401 Unauthorized
    }

    // Si l'usuari només ha canviat el seu nom i no l'email, sense "u.id !== id" emailRepetit seria true,
    // perquè es trobaria que exisiteix un usuari amb aquell email (ell mateix). Amb "u.id !== id" aconseguim
    // que no es retorni un error d'email repetit quan només es canvia el nom, perquè busquem si un usuari diferent
    // al que està editant el seu perfil té l'email introduït per l'usuari
    const emailRepetit = db.usuaris.some(u => u.email === email && u.id !== id);
    if (emailRepetit) {
        // No poden haver-hi dos usuaris amb el mateix email
        return res.status(400).json({ error: 'Aquest email ja és utilitzat per un altre usuari' });
    }

    usuari.nom = nom;
    usuari.email = email;
    fs.writeFileSync(DATABASE_PATH, JSON.stringify(db, null, 2));

    const usuariResposta = { // Per seguretat no enviem la contrasenya. L'usuari l'haurà d'introduir per fer certes accions
        id: usuari.id,
        nom: usuari.nom,
        email: usuari.email
    };

    res.json({
        message: 'Dades modificades correctament',
        usuari: usuariResposta
    });
});

// Canvia la contrasenya de l'usuari
app.patch('/usuaris/:id/contrasenya', authentication, function (req, res) {
    const { contrasenya_actual, contrasenya_nova } = req.body;

    if (!contrasenya_actual || !contrasenya_nova) {
        return res.status(400).json({ error: 'Cal proporcionar la contrasenya actual i la nova' });
    }

    const db = read_database();
    const id = parseInt(req.params.id);

    const usuari = db.usuaris.find(u => u.id === id);
    if (!usuari) {
        return res.status(404).json({ error: 'Usuari no trobat'});
    }

    if (usuari.contrasenya !== contrasenya_actual) {
        return res.status(401).json({ error: 'La contrasenya actual introduïda és incorrecta' });
    }

    if (contrasenya_actual === contrasenya_nova) {
        // Enviem 400 i no 200 perquè l'usuari ha indicat explícitament que vol canviar la seva contrasenya per una de diferent
        // i no ho ha fet, i aquesta operació no té sentit
        return res.status(400).json({ error: "La nova contrasenya i l'actual no poden ser iguals. No s'ha realitzat cap modificació" });
    }

    usuari.contrasenya = contrasenya_nova;

    fs.writeFileSync(DATABASE_PATH, JSON.stringify(db, null, 2));

    res.json({ message: 'Contrasenya actualitzada correctament' });
});

// Elimina de la base de dades un usuari i tots els préstecs que té associats
app.delete('/usuaris/:id', authentication, function (req, res) {
    const db = read_database();
    const id = parseInt(req.params.id);

    const usuari = db.usuaris.find(u => u.id === id);
    if (!usuari) {
        return res.status(404).json({ error: 'Usuari no trobat' });
    }

    // Un usuari no es pot eliminar si té préstecs actius
    const prestecsActiusUsuari = db.prestecs.filter(p => p.usuari_id === id && !p.retornat);
    if (prestecsActiusUsuari.length > 0) {
        return res.status(400).json({ error: "No es pot eliminar el compte d'usuari perquè té préstecs actius" });
    }

    // Si l'usuari no té préstecs actius, l'eliminem
    db.usuaris = db.usuaris.filter(u => u.id !== id); // Agafem tots els usuaris de la base de dades menys el que tingui el
    // identificador que hi ha a la URL de l'endpoint
    db.prestecs = db.prestecs.filter(p => p.usuari_id !== id); // Agafem tots els préstecs de la base de dades menys els que
    // estiguin associats a l'usuari amb l'identificador de l'endpoint

    fs.writeFileSync(DATABASE_PATH, JSON.stringify(db, null, 2));
    res.json({ message: 'Usuari eliminat correctament' });
});

// Elimina totes les sessions de la base de dades de l'usuari
app.delete('/logout/:id', authentication, function (req, res) {
    const db = read_database();
    const id = parseInt(req.params.id);

    if (req.usuari_id !== id) {
        // Necessitem autenticar l'usuari per si està intentant tancar la sessió d'un altre usuari
        return res.status(403).json({ error: 'No tens permís per tancar aquesta sessió' }); // El codi 403 indica que l'usuari no té permís per fer aquesta acció
    }

    db.sessions = db.sessions.filter(s => s.usuari_id !== id); // Eliminem totes les sessions obertes de l'usuari (i no només una per si quedava alguna sense eliminar
    // per qualsevol motiu)
    fs.writeFileSync(DATABASE_PATH, JSON.stringify(db, null, 2));
    res.json({message: 'Sessió tancada correctament'});
})

// LLIBRES

// Obté tots els llibres amb paginació i amb possibilitat de buscar per títol i afegir un filtre de categoria
app.get('/llibres', function (req, res) {
    const db = read_database();

    let llibres = db.llibres;

    // Filtres de categoria i titol/autor/any
    if (req.query.categoria && req.query.categoria !== "") {  // Per evitar espais en blanc
        llibres = llibres.filter(l => l.categoria === req.query.categoria);
    }

    const camp = req.query.camp; // titol, autor o any
    const valor = req.query.valor; // Text de la barra de cerca

    if (camp && valor && valor.trim() !=="") {
        const valorLowercase = valor.toLowerCase();
        llibres = llibres.filter(l => {
            const valorDelCamp = String(l[camp]).toLowerCase(); // Accedim a l[titol], l[autor] o l[any]
            return valorDelCamp.includes(valorLowercase); // Si el titol/autor/any té com a substring "valorLowercase",
            // passa el filtre i s'envia al client
        });
    }

    const page = parseInt(req.query.page) || 1;
    limit = 9; // No l'enviarà el client
    const start = (page -1) * limit;
    const end = start + limit; // Posició del primer llibre que no s'agafa

    const llibresPagina = llibres.slice(start, end);

    res.json({
        llibres: llibresPagina,
        total: llibres.length,
        pagina: page,
        num_pagines: Math.ceil(llibres.length/limit) // Per exemple, si tenim un llibre, el resultat d'aquest càlcul serà 1 perquè la divisió donaria 0.2,
        // i 1 és l'enter superior immediat
    });
});

// Obté un llibre en concret
app.get('/llibres/:id', function (req, res) {
    const db = read_database();
    const id = parseInt(req.params.id); // Obtenim l'identificador del llibre que es vol buscar
    const llibre = db.llibres.find(l => l.id === id); // Busquem el llibre amb aquest identificador a la base de dades

    if (!llibre) {
        return res.status(404).json({ error: 'Llibre no trobat' });
    }

    res.json(llibre);
});


// PRÉSTECS

// Obté tots els préstecs (NO UTILITZAT)
/* app.get('/prestecs', function (req, res) {
    const db = read_database();
    res.json(db.prestecs);
}); */

// Obté un préstec en concret
/*app.get('/prestecs/:id', function (req, res) {
    const db = read_database();
    const id = parseInt(req.params.id); // Obtenim l'identificador del préstec que es vol buscar
    const prestec = db.prestecs.find(p => p.id === id);

    if (!prestec) {
        return res.status(404).json({ error: 'Préstec no trobat' });
    }

    res.json(prestec);
});*/

// Crea un nou préstec tenint en compte totes les Restriccions d'Integritat Textuals del diagrama UML. En resum, les restriccions que es comproven, en aquest ordre, són:
// 1. El llibre demanat ha d'estar disponible per poder ser prestat
// 2. Només pot existir un únic préstec del llibre demanat amb un estat de retornat = false
// 3. L'any de publicació del llibre no pot ser posterior a l'any d'inici i l'any de final del préstec
// 4. La data d'inici del préstec ha de ser anterior a la data de fi del préstec
// 5. Si l'usuari que vol fer el préstec té un o més llibres prestats amb una data de fi del préstec anterior a la data en la qual es vol
// fer el préstec, no podrà fer préstecs fins que es retornin tots aquests llibres
// 6. L'usuari que vol fer el préstec no pot tenir més de 3 préstecs actius
app.post('/prestecs', authentication, function (req, res) {
    const db = read_database();
    const {usuari_id, llibre_id} = req.body;

    if (!usuari_id || !llibre_id) {
        return res.status(400).json({ error: 'Falta usuari_id i/o llibre_id, que són camps obligatoris' });
    }

    const usuari = db.usuaris.find(u => u.id === usuari_id);
    if (!usuari) {
        return res.status(404).json({ error: 'Usuari no trobat'}); 
    }

    const llibre = db.llibres.find(l => l.id === llibre_id);
    if (!llibre) {
        return res.status(404).json({ error: 'Llibre no trobat' });
    }

    // Les RIT que es mostren a continuació fan referència a les RIT del diagrama UML

    // RIT2: No pot existir més d'un préstec p associat al llibre l amb p.retornat = false 
    const prestecActiuLlibre = db.prestecs.find(p => p.llibre_id === llibre_id && p.retornat === false);
    if (prestecActiuLlibre) {
        return res.status(400).json({ error: "Aquest llibre el té prestat actualment un usuari" })
    }

    // RIT1: Només es pot fer un préstec d'un llibre l si l.disponible === true
    // Posem la RIT2 abans que la 1 perquè així l'usuari pot saber si el llibre no està disponible perquè
    // l'ha agafat prestat un altre usuari o perquè els administradors l'han marcat com a no disponible
    if (!llibre.disponible) {
        return res.status(400).json({ error: 'El llibre no està disponible per a préstec' })
    }

    // RIT4: La data d'inici del préstec ha de ser menor a la data final del préstec
    const avui = new Date();
    const inici = avui.toISOString().split('T')[0]; // Només volem saber quin dia (amb mes i any) comença i finalitza
    // el préstec. Un usuari pot retornar un llibre fins l'últim dia del préstec, en qualsevol hora d'aquell dia
    // Es fa "split" utilitzant el caràcter T perquè a l'esquerra de la T es troba l'any, el mes i el dia de la data.
    // Exemple de data sense aplicar-li "split":2026-02-01T13:28:06.419Z

    const ultimDiaPrestec = new Date(avui);
    ultimDiaPrestec.setMonth(ultimDiaPrestec.getMonth() + 1); // Els usuaris tindran un mes per retornar els llibres
    const final = ultimDiaPrestec.toISOString().split('T')[0];

    // RIT3: L'any de la data d'inici i el del final del préstec han de ser major o iguals a l'any en què va sortir el
    // llibre que es vol prestar
    if (avui.getFullYear() < llibre.any || ultimDiaPrestec.getFullYear() < llibre.any) {
        return res.status(400).json({ error: "Els anys de les dates d'inici i fi del préstec no poden ser anteriors a l'any de publicació del llibre" })
    }

    // RIT6: Un usuari no pot fer cap préstec si té un o més llibres sense retornar amb una data de final de préstec
    // anterior a la data actual
    const prestecAmbRetard = db.prestecs.find(p => {
        if (p.usuari_id !== usuari_id) return false;
        if (p.retornat === true) return false;
        
        const firstDelayDate = new Date(p.final);
        firstDelayDate.setDate(firstDelayDate.getDate() + 1);
        return firstDelayDate <= avui; // Comprovem si avui és el dia següent al final del préstec o més tard
    });

    if (prestecAmbRetard) {
        return res.status(400).json({ error: "L'usuari té llibres, amb préstec vençut, sense retornar. No es pot fer un nou préstec fins que es retornin tots aquests llibres"})
    }

    // RIT5: Un usuari no pot tenir més de 3 préstecs actius alhora
    const prestecsActiusUsuari = db.prestecs.filter(p => p.usuari_id === usuari_id && p.retornat === false); // Obtenim tots els préstecs actius de l'usuari
    if (prestecsActiusUsuari.length >= 3) {
        return res.status(400).json({ error: "L'usuari ja té tres préstecs actius. No es poden tenir més de tres préstecs actius alhora" })
    }

    nouIdPrestec = db.prestecs.length > 0 ? Math.max(...db.prestecs.map(p => p.id)) + 1 : 1;
    nouPrestec = {
        id: nouIdPrestec,
        usuari_id,
        llibre_id,
        inici,
        final,
        retornat : false
    }

    llibre.disponible = false; // Un llibre deixa d'estar disponible si algú l'ha prestat
    // Com que "llibre" és una referència a un objecte dins de "db", si modifiquem "llibre",
    // modificarem també l'objecte que hi ha dins de l'array db.llibres


    db.prestecs.push(nouPrestec); // Afegim el nou préstec a l'array de préstecs de l'objecte "db"
    fs.writeFileSync(DATABASE_PATH, JSON.stringify(db, null, 2)); // Guarda els canvis en el fitxer JSON, convertint l'objecte "db" en un
    // string JSON. Amb "null" indiquem que no volem fer servir cap funció addicional per filtrar abans de fer el "stringify" i amb "2"
    // s'escriu al fitxer amb dos espais en blanc com indentació

    res.status(201).json(nouPrestec); // Amb "201" indiquem que s'ha creat un nou recurs i enviem al client el nou préstec creat
});

// Marca un préstec com "retornat", posant el seu booleà "retornat" a true i fent que el llibre al qual està associat tingui
// també el seu booleà "disponible" amb valor true
app.patch('/prestecs/:id/retornar', authentication, function (req, res) {
    const db = read_database();
    const id = parseInt(req.params.id) // Obtenim l'identificador del préstec

    const prestec = db.prestecs.find(p => p.id === id);
    if (!prestec) {
        return res.status(404).json({ error: 'Préstec no trobat' });
    }

    // Comprovem si el préstec ja està marcat com retornat per evitar escriptures innecesàries
    if (prestec.retornat) {
        return res.status(400).json({ error: 'Aquest préstec ja està marcat com a retornat' });
    }

    const llibre = db.llibres.find(l => l.id === prestec.llibre_id);
    if (!llibre) {
        // Si, per algun motiu, no es troba el llibre associat a aquest préstec, enviem un
        // codi 500 Internal Server Error
        return res.status(500).json({ error: 'El servidor no ha pogut trobar el llibre associat a aquest préstec' });
    }

    // Marquem el préstec com a retornat i el llibre com a disponible
    prestec.retornat = true;
    llibre.disponible = true;

    fs.writeFileSync(DATABASE_PATH, JSON.stringify(db, null, 2));

    res.json({ message: 'Llibre retornat correctament', prestec });
});

const server = app.listen(8000);