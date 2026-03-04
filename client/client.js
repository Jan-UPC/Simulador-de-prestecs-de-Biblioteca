/*jshint esversion: 6 */
$(document).ready(function() {

    usuariLogejat = null;

    // Paginació llibres
    let paginaActualLlibres = 1;
    let paginesTotalsLlibres = 1;

    // Paginació préstecs
    let paginaActualPrestecs = 1;
    let paginesTotalsPrestecs = 1;


    // ########## FUNCIONS ##########

    // Mostra la secció de la web identificada per "idSeccio", amagant la resta
    function mostrarSeccio(idSeccio) {
        // Amaguem totes les seccions, tot i que només una d'aquestes era visible,
        // i després mostrem la secció amb identificador "idSeccio". A més, netegem tots
        // els missatges d'avís i camps de text

        $('.seccio').addClass('d-none');

        // Netegem els camps dels formularis
        $('.camp-formulari').val('');
        
        // Netegem els missatges d'avís:
        $('.missatge').text('');

        if (idSeccio === '#seccio-llibres') {
            carregarLlibres();
        }

        $(idSeccio).removeClass('d-none');
    }

    function mostrarModalSessioExpirada() {
        $('#modal-missatge-titol').text("La seva sessió ha expirat").removeClass().addClass("text-normal");
        $('#modal-missatge-motiu').text("Si us plau, torni a iniciar sessió.").removeClass().addClass("text-normal");
        const modal_missatge = new bootstrap.Modal($('#modal-missatge'));
        modal_missatge.show();
    }

    // Mostra tots els llibres, amb possibilitat de buscar per títol i afegir un filtre de categoria, que té la Biblioteca
    async function carregarLlibres() {
        try {
            const categoria = $('#filtre-categoria').val();
            const camp = $('#filtre-camp').val(); // Títol, autor o any
            const valor = $('#filtre-valor').val();
            const resposta = await fetch(`http://localhost:8000/llibres?page=${paginaActualLlibres}&categoria=${encodeURIComponent(categoria)}&camp=${encodeURIComponent(camp)}`+
            `&valor=${encodeURIComponent(valor)}`);
            // Amb "encodeURIComponent()" aconseguim que la categoria i el títol viatgin de manera segura en una URL, permetent espais, accents
            // i altres símbols que, sense codificar correctament, podrien trencar la URL

            if (!resposta.ok) {
                // Comprovació per precaució, tot i que el servidor no hauria d'enviar cap codi d'error amb aquesta petició
                const error = await resposta.json();
                console.log('Error en obtenir la llista de llibres');
                 $('#llista-llibres').html(`
                <div class='alert alert-danger'>
                    Error en obtenir la llista de llibres: ${error.error}
                </div>
                `)
                $('#llibres-pagina').text('');
                $('#llibres-anterior').addClass('d-none');
                $('#llibres-seguent').addClass('d-none');
                return;
            }

            const dades = await resposta.json();
            const llibres = dades.llibres;
            paginaActualLlibres = dades.pagina;
            paginesTotalsLlibres = dades.num_pagines;
            if (paginesTotalsLlibres === 0) {
                // Si no detectem això, apareixerà "Pàgina 1/0"
                 $('#llibres-pagina').text('');
                 $('#llibres-anterior').addClass('d-none');
                 $('#llibres-seguent').addClass('d-none');
            }
            else {
                $('#llibres-pagina').text(`Pàgina ${paginaActualLlibres}/${paginesTotalsLlibres}`);
                $('#llibres-anterior').removeClass('d-none');
                 $('#llibres-seguent').removeClass('d-none');
            }
            
            const contingut = $('#llista-llibres');
            contingut.empty(); // Elimina tot el contingut HTML intern de la llista de llibres, per esborrar la llista que hi havia abans o
            // el missatge d'error, si hi havia algun
            
            if (llibres.length === 0) {
                $('#llista-llibres').html(`
                    <div class="alert alert-warning">
                        No s'ha trobat cap llibre que coincideixi amb la cerca.
                    </div>
                `);
                return; 
            }

            llibres.forEach(llibre => {
                const disponible = llibre.disponible ? '<p class="fw-bold text-success">Disponible</p>' : '<p class="fw-bold text-danger">No disponible</p>';
                const html = `
                    <div class="col-md-4">
                        <!--Quan la pantalla sigui de mesura mitjana o més gran, la targeta ocuparà 4 columnes (hi ha 12 en total a Bootstrap-->
                        <!--Si no li indiquem res, per defecte quan la pantalla sigui de mida menor a mida mitjana, cada targeta ocuparà 12 columnes-->
                        <div class="card h-100 shadow-sm targeta-llibre p-3" data-id="${llibre.id}">
                            <!--Amb "h-100" obliguem  a cada targeta a que s'estiri per ocupar tota l'altura de la seva columna,
                            fent que totes les targetes s'estirin fins igualar l'altura de la targeta més alta de la fila-->
                            <h5 class="fw-bold">${llibre.titol}</h5>
                            <p class="mb-1">Autor: ${llibre.autor}</p>
                            <p class="mb-1">Any de publicació: ${llibre.any}</p>
                            <p class="mb-1">Categoria: ${llibre.categoria}</p>
                            ${disponible}
                        </div>
                    </div>
                    `;
                    contingut.append(html); // Afegim a la llista dels llibres informació del llibre de la iteració actual
            });

        } catch (error) {
            console.log('Error de xarxa:', error);
            $('#llista-llibres').html(`
                <div class='alert alert-danger'>
                    Error de connexió amb el servidor. No s'han pogut carregar els llibres.
                </div>
            `);
            $('#llibres-pagina').text('');
            $('#llibres-anterior').addClass('d-none');
            $('#llibres-seguent').addClass('d-none');
        }
    }

    // Intenta iniciar sessió amb un token, sense haver introduïr credencials
    async function intentarLoginAmbToken() {
        const token = localStorage.getItem('token');
        if (token) {
        // Si tenim un token guardat, l'intentem utilitzar per iniciar sessió automàticament
            const resposta = await fetch('http://localhost:8000/sessio', {
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            });

            if (!resposta.ok) {
                localStorage.removeItem('token'); // L'eliminem perquè ja no serveix
                return;
            }
            else {
                const dades = await resposta.json();
                usuariLogejat = dades.usuari;
                logejarUsuari();
            }
        }
    }

    intentarLoginAmbToken();

    // Mostra tots els préstecs que ha realitzat l'usuari
    async function carregarPrestecs() {
        try {
            const filtrarPendents = $('#checkbox-no-retornats').is(':checked');
            const token = localStorage.getItem('token');
            const resposta = await fetch(`http://localhost:8000/usuaris/${usuariLogejat.id}/prestecs?page=${paginaActualPrestecs}&no_retornats=${filtrarPendents}`,
                {
                    headers: {
                        'Authorization': 'Bearer ' + token
                    }
                }
            );

            if (!resposta.ok) {
                const error = await resposta.json();
                if (resposta.status === 401 && 'errorToken' in error) {
                    // Llavors el token no s'ha acceptat, el que significa que la sessió no és vàlida
                    deslogejarUsuari(true);
                    return;
                }
                console.log('Error en obtenir la llista de préstecs');
                 $('#llista-prestecs').html(`
                <div class='alert alert-danger'>
                    Error en obtenir la llista de préstecs: ${error.error}
                </div>
                `)
                $('#prestecs-pagina').text('');
                $('#prestecs-anterior').addClass('d-none');
                $('#prestecs-seguent').addClass('d-none');
                return;
            }

            const dades = await resposta.json();
            const prestecs = dades.prestecs;
            paginaActualPrestecs = dades.pagina;
            paginesTotalsPrestecs = dades.num_pagines;
            let no_retornats = dades.no_retornats;
            $('#prestecs-pendents').text(no_retornats);
            $('#prestecs-pagina').text(`Pàgina ${paginaActualPrestecs}/${paginesTotalsPrestecs}`);
            
            const contingut = $('#llista-prestecs');
            contingut.empty();
            
            if (paginesTotalsPrestecs === 0) {
                // Si no detectem això, apareixerà "Pàgina 1/0"
                 $('#prestecs-pagina').text('');
                 $('#prestecs-anterior').addClass('d-none');
                 $('#prestecs-seguent').addClass('d-none');
            }
            else {
                $('#prestecs-pagina').text(`Pàgina ${paginaActualPrestecs}/${paginesTotalsPrestecs}`);
                $('#prestecs-anterior').removeClass('d-none');
                $('#prestecs-seguent').removeClass('d-none');
            }

            if (prestecs.length === 0 ) {
                if (filtrarPendents) {
                    $('#llista-prestecs').html(`
                        <div class="alert alert-warning">
                            No hi ha cap préstec sense retornar.
                        </div>
                    `);
                    return;
                }
                else {
                    $('#llista-prestecs').html(`
                        <div class="alert alert-warning">
                            No s'ha realitzat cap préstec.
                        </div>
                    `);
                    return;
                }
            }

            for (const prestec of prestecs) {
                // Hem de demanar al servidor la informació de cada llibre
                const respostaLlibre = await fetch(`http://localhost:8000/llibres/${prestec.llibre_id}`);
                const llibre = await respostaLlibre.json();

                let textRetornat = null;
                let textDataRetorn = null;
                let botoRetornar = null;

                if (prestec.retornat) {
                    textRetornat = '<span class="text-success">Sí</span>';
                    textDataRetorn = '';
                    botoRetornar = '';
                }
                else {
                    textRetornat = '<span class="text-danger">No</span>';
                    textDataRetorn = `<p class="fw-bold">Data límit de retorn (YYYY-MM-DD): <span>${prestec.final}</span></p>`;
                    botoRetornar = `<button class="btn btn-success button-retornar" data-id="${prestec.id}">Retornar</button>`;
                }

                const html = `
                    <div class="col-12">
                        <div class="card shadow-sm p-3" data-id d-flex flex-row justify-content-between align-items-center">
                            <div>
                                <h5 class="fw-bold" id="titol-prestec-${prestec.id}">${llibre.titol}</h5>
                                <p class="mb-1">Autor: ${llibre.autor}</p>
                                <p class="mb-1">Editorial: ${llibre.editorial}</p>
                                <p class="mb-1">Any de publicació: ${llibre.any}</p>
                                <p class="mb-1">Categoria: ${llibre.categoria}</p>
                                <p class="mb-1">ISBN: ${llibre.ISBN}</p>
                                <p class="fw-bold mb-1">Retornat: ${textRetornat}</p>
                                ${textDataRetorn}
                            </div>
                            ${botoRetornar}
                        </div>
                    </div>
                    `;
                    contingut.append(html); // Afegim a la llista dels préstecs informació del llibre de la iteració de préstec actual
            }
            

        } catch (error) {
            console.log('Error de xarxa:', error);
            $('#llista-prestecs').html(`
                <div class='alert alert-danger'>
                    Error de connexió amb el servidor. No s'han pogut carregar els préstecs.
                </div>
            `);
            $('#prestecs-pagina').text('');
            $('#prestecs-anterior').addClass('d-none');
            $('#prestecs-seguent').addClass('d-none');
        }
    }

    // Tanca la sessió de l'usuari, tant si s'ha fet logout com si s'ha eliminat el compte, retornant a la pàgina d'inici
    function deslogejarUsuari(tokenExpirat = false) {
        localStorage.removeItem('token'); // Eliminem el token perquè la sessió corresponen a aquest s'ha tancat
        usuariLoguejat = null;

        // Reiniciar valors de paginació
        paginaActualLlibres = 1;
        paginesTotalsLlibres = 1;
        paginaActualPrestecs = 1;
        paginesTotalsPrestecs = 1;

        // Reiniciar nombre de llibres sense retornar
        $('#prestecs-pendents').text('0');
        
        // Treure botons del header
        $('#nav-perfil').addClass('d-none');
        $('#nav-llibres').addClass('d-none');
        $('#nav-prestecs').addClass('d-none');
        $('#nav-logout').addClass('d-none');

        // Tornar a la secció inicial
        mostrarSeccio('#seccio-inicial');
        if (tokenExpirat) {
            mostrarModalSessioExpirada();
        }
    }

    // Fa que apareguin tots els elements de la pantalla que només poden veure els usuaris amb sessió iniciada
    function logejarUsuari() {
        $('#benvinguda-usuari').text(`Benvingut/da, ${usuariLogejat.nom}`);
        $('#perfil-nom').text(`${usuariLogejat.nom}`);
        $('#perfil-email').text(`${usuariLogejat.email}`);
        $('#filtre-categoria').val('');
        $('#filtre-titol').val('');
        mostrarSeccio('#seccio-llibres');

        $('#nav-perfil').text(`Perfil d'usuari: ${usuariLogejat.nom}`);
        $('#nav-perfil').removeClass('d-none');
        $('#nav-llibres').removeClass('d-none');
        $('#nav-prestecs').removeClass('d-none');
        $('#nav-logout').removeClass('d-none');
    }

    // ########## ESDEVENIMENTS ##########

    // Botons per canviar de secció
    $('#button-inicial-a-creacio').on('click', function() {
        mostrarSeccio('#seccio-crear-compte');
    });

    $('#button-inicial-a-login').on('click', function() {
        mostrarSeccio('#seccio-login');
    });

    $('.button-tornar-inici').on('click', function() {
        mostrarSeccio('#seccio-inicial');
    });

    $('#nav-login').on('click', function() {
        mostrarSeccio('#seccio-login');
    });

    $('#nav-llibres').on('click', function() {
        mostrarSeccio('#seccio-llibres');
    });

    $('#nav-prestecs').on('click', function() {
        carregarPrestecs();
        mostrarSeccio('#seccio-prestecs');
    });

    $('#nav-logout').on('click', function() {
        mostrarSeccio('#seccio-logout');
    });

    $('#button-logout').on('click', async function() {
        const token = localStorage.getItem('token');
        const resposta = await fetch(`http://localhost:8000/logout/${usuariLogejat.id}`,{
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
        });
        

        if (!resposta.ok) {
            const error = await resposta.json();
            if (resposta.status === 401 && 'errorToken' in error) {
                // Llavors el token no s'ha acceptat, el que significa que la sessió no és vàlida, obtenint el mateix resultat: deslogejar-se, però per culpa d'un token invàlid
                deslogejarUsuari(true);
                return;
            }
            $('#modal-missatge-titol').text("S'ha produït un error en tancar la sessió").removeClass().addClass("text-normal");
            $('#modal-missatge-motiu').text("Si us plau, torni a provar-ho.").removeClass().addClass("text-normal");
            const modal_missatge = new bootstrap.Modal($('#modal-missatge'));
            modal_missatge.show();
        }
        
        deslogejarUsuari();
    });

    $('#nav-perfil').on('click', function() {
        mostrarSeccio('#seccio-perfil');
    });

    $('#button-enrere-perfil').on('click', function() {
        mostrarSeccio('#seccio-llibres');
    });

    $('#button-enrere-logout').on('click', function() {
        mostrarSeccio('#seccio-llibres');
    });

    $('#button-editar-perfil').on('click', function() {
        mostrarSeccio('#seccio-modificar');
        // Afegim els valors als camps després de "mostrarSeccio" perquè aquesta funció neteja tots els camps de formulari
        $('#modificar-nom').val(usuariLogejat.nom);
        $('#modificar-email').val(usuariLogejat.email);
    });

    $('.button-tornar-perfil').on('click', function() {
        mostrarSeccio('#seccio-perfil');
    });

    $('#button-canviar-contrasenya').on('click', function () {
        mostrarSeccio('#seccio-canviar-contrasenya');
    });

    // Mostrar modal de llibre quan es detecta un clic sobre la targeta d'un llibre
    $('#llista-llibres').on('click', '.targeta-llibre', async function() {
        // Apliquem l'esdeveniment a "#llista-llibres" i no la classe "targeta-llibre" perquè quan es carrega aquest fitxer JavaScript no
        // hi ha cap element amb aquesta classe (perquè aquests elements s'afegeixen dinàmicament). D'aquesta manera, quan es clica un element,
        // la llista de llibres intercepta l'esdeveniment i jQuery comprova si l'element clicat és de la classe "targeta-llibre" i, en aquest cas,
        // executa la funció
        const id = $(this).data('id');
        
        try {
            const resposta = await fetch(`http://localhost:8000/llibres/${id}`);

            if (!resposta.ok) {
                const error = await resposta.json();
                $('#modal-missatge-titol').text("S'ha produït un error en carregar el llibre");
                $('#modal-missatge-motiu').text(error.error);
                const modal = new bootstrap.Modal($('#modal-missatge'));
                modal.show();
            }

            const llibre = await resposta.json();
            $('#missatge-prestec-1').text("");
            $('#missatge-prestec-2').text("");

            // Posem al modal tota la informació del llibre
            $('#modal-titol').text(llibre.titol);
            $('#modal-autor').text(llibre.autor);
            $('#modal-editorial').text(llibre.editorial);
            $('#modal-any').text(llibre.any);
            $('#modal-categoria').text(llibre.categoria);
            $('#modal-isbn').text(llibre.ISBN);
            if (llibre.disponible) {
                $('#modal-disponibilitat').text('Disponible').removeClass('text-danger').addClass('text-success');
                $('#modal-reservar').data('id', id); // Guardem al botó de reservar l'identificador del llibre per si l'usuari el vol reservar
                $('#modal-reservar').removeClass('d-none'); // Només mostrem el botó de reservar si el llibre està disponible
            }
            else {
                $('#modal-disponibilitat').text('No disponible').removeClass('text-success').addClass('text-danger');
                $('#modal-reservar').addClass('d-none'); // Si el llibre no està disponible, no el mostrem
            }

            const modal = new bootstrap.Modal($('#modal-llibre'));
            modal.show();

        } catch (error) {
            console.error('Error de xarxa:', error);
            $('#modal-missatge-titol').text("S'ha produït un error en carregar el llibre.").removeClass().addClass("text-danger");
            $('#modal-missatge-motiu').text('Motiu: Error de connexió amb el servidor.').removeClass().addClass("text-danger");
            const modal = new bootstrap.Modal($('#modal-missatge'));
            modal.show();
        }

    });

    // Fer la reserva d'un llibre quan es clica el botó de reservar en la finestra modal d'un llibre en concret
    $('#modal-reservar').on('click', async function() {
        const id = $(this).data('id'); // Obtenim l'identificador del llibre a reservar, que es troba en aquest botó gràcies a l'esdeveniment
        // que mostra el modal
        token = localStorage.getItem('token');

        try {
            const resposta = await fetch('http://localhost:8000/prestecs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({
                    usuari_id: usuariLogejat.id,
                    llibre_id: id
                })
            });

            if (!resposta.ok) {
                const error = await resposta.json();
                if (resposta.status === 401 && 'errorToken' in error) {
                    // Llavors el token no s'ha acceptat, el que significa que la sessió no és vàlida
                    const modal_llibre = bootstrap.Modal.getInstance($('#modal-llibre').get(0)); // Fem get(0) perquè getInstance de Bootstrap només accepta elements del DOM
                    modal_llibre.hide();
                    deslogejarUsuari(true);
                    return;
                }
                $('#missatge-prestec-1').text("S'ha produït un error en realitzar el préstec.").removeClass().addClass("text-danger");
                $('#missatge-prestec-2').text(`Motiu: ${error.error}`).removeClass().addClass("text-danger");
                return;
            }

            const modal_llibre = bootstrap.Modal.getInstance($('#modal-llibre').get(0)); // Fem get(0) perquè getInstance de Bootstrap només accepta elements del DOM
            modal_llibre.hide();
            $('#modal-missatge-titol').text('Has reservat correctament el llibre!').removeClass().addClass("text-success");
            $('#modal-missatge-motiu').text("Pots trobar informació de la reserva a l'apartat dels teus préstecs.").removeClass().addClass("text-normal");
            const modal_missatge = new bootstrap.Modal($('#modal-missatge'));
            modal_missatge.show();
            carregarLlibres();

        } catch (error) {
            console.error('Error de xarxa:', error);
            $('#missatge-prestec-1').text("S'ha produït un error en realitzar el préstec.").removeClass().addClass("text-danger");
            $('#missatge-prestec-2').text("Motiu: Error de connexió amb el servidor.").removeClass().addClass("text-danger");
        }
    });

    // Clicar en el botó de "Retornar" per després confirmar el torn
    $('#llista-prestecs').on('click', '.button-retornar', async function() {
        $('#missatge-retorn-1').text("");
        $('#missatge-retorn-2').text("");

        idPrestec = $(this).data('id');
        titolLlibre = $(`#titol-prestec-${idPrestec}`).text();
        $('#modal-retorn-titol').text(titolLlibre);
        $('#modal-button-retorn').data('id', idPrestec);

        const modal = new bootstrap.Modal($('#modal-retorn'));
        modal.show();
    });

    // Confirmar el retorn d'un llibre
    $('#modal-button-retorn').on('click', async function() {
        try {
            idPrestec = $(this).data('id');
            const token = localStorage.getItem('token');
            const resposta = await fetch(`http://localhost:8000/prestecs/${idPrestec}/retornar`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
            });

            if (!resposta.ok) {
                const error = await resposta.json();
                if (resposta.status === 401 && 'errorToken' in error) {
                    // Llavors el token no s'ha acceptat, el que significa que la sessió no és vàlida
                    const modal_retorn = bootstrap.Modal.getInstance($('#modal-retorn').get(0)); // Fem get(0) perquè getInstance de Bootstrap només accepta elements del DOM
                    modal_retorn.hide();
                    deslogejarUsuari(true);
                    return;
                }
                $('#missatge-retorn-1').text("S'ha produït un error en retornar el llibre.").removeClass().addClass("text-danger");
                $('#missatge-retorn-2').text(`Motiu: ${error.error}`).removeClass().addClass("text-danger");
            }

            const modal_retorn = bootstrap.Modal.getInstance($('#modal-retorn').get(0)); // Fem get(0) perquè getInstance de Bootstrap només accepta elements del DOM
            modal_retorn.hide();
            $('#modal-missatge-titol').text('Has retornat correctament el llibre!').removeClass().addClass("text-success");
            $('#modal-missatge-motiu').text("Gràcies per utilitzar el servei de préstecs de la Biblioteca.").removeClass().addClass("text-normal");
            const modal_missatge = new bootstrap.Modal($('#modal-missatge'));
            modal_missatge.show();
            carregarPrestecs();

        } catch (error) {
            console.error('Error de xarxa:', error);
            $('#missatge-retorn-1').text("S'ha produït un error en retornar el llibre.").removeClass().addClass("text-danger");
            $('#missatge-retorn-2').text("Motiu: Error de connexió amb el servidor.").removeClass().addClass("text-danger");
        }
    })
    
    // Anar a la pàgina de llibres anterior
    $('#llibres-anterior').on('click', function () {
        if (paginaActualLlibres > 1) {
            paginaActualLlibres--;
            carregarLlibres();
        }
    });

    // Anar a la següent pàgina de llibres
    $('#llibres-seguent').on('click', function () {
        if (paginaActualLlibres < paginesTotalsLlibres) {
            paginaActualLlibres++;
            carregarLlibres();
        }
    });

    // Anar a la pàgina anterior
    $('#prestecs-anterior').on('click', function () {
        if (paginaActualPrestecs > 1) {
            paginaActualPrestecs--;
            carregarPrestecs();
        }
    });

    // Anar a la següent pàgina de llibres
    $('#prestecs-seguent').on('click', function () {
        if (paginaActualPrestecs < paginesTotalsPrestecs) {
            paginaActualPrestecs++;
            carregarPrestecs();
        }
    });

    // Recarregar la llista de préstecs quan es clica la checkbox de la secció de préstecs
    $('#checkbox-no-retornats').on('change', function() {
        paginaActualPrestecs = 1; // Sempre que recarreguem la llista per un filtre, hem de tornar a la pàgina 1
        carregarPrestecs();
    });

    // S'aplicaran els filtres de categoria i títol quan l'usuari premi Enter mentre escriu a la barra de cerca per títol,
    // quan fa clic en el botó de "Cercar" o quan canvia el filtre de categoria
    $('#button-fer-cerca').on('click', function() {
        paginaActualLlibres = 1; // Sempre que recarreguem la llista per un filtre, hem de tornar a la pàgina 1
        carregarLlibres();
    });

    $('#filtre-valor').on('keypress', function(e) {
        if (e.key === 'Enter') {
            paginaActualLlibres = 1; // Sempre que recarreguem la llista per un filtre, hem de tornar a la pàgina 1
            carregarLlibres();
        }
    });

    $('#filtre-categoria').on('change', function() {
        paginaActualLlibres = 1; // Sempre que recarreguem la llista per un filtre, hem de tornar a la pàgina 1
        carregarLlibres();
    });

    // Mostrar modal de confirmació d'eliminació de compte quan es detecta un clic sobre el botó d'eliminar compte
    $('#button-eliminar-compte').on('click', function() {
        $('#missatge-eliminar-compte-1').text(""); // Netegar missatge per si abans hi havia algun missatge d'error
        $('#missatge-eliminar-compte-2').text(""); // Netegar missatge per si abans hi havia algun missatge d'error
        const modal = new bootstrap.Modal($(`#modal-eliminar-compte`));
        modal.show();
    });

    // Eliminar compte després de la confirmació
    $('#modal-button-eliminar-compte').on('click', async function() {
        try {
            const token = localStorage.getItem('token');
            const resposta = await fetch(`http://localhost:8000/usuaris/${usuariLogejat.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            });

            if (!resposta.ok) {
                const error = await resposta.json();
                if (resposta.status === 401 && 'errorToken' in error) {
                    // Llavors el token no s'ha acceptat, el que significa que la sessió no és vàlida
                    const modal_eliminar = bootstrap.Modal.getInstance($('#modal-eliminar-compte').get(0)); // Fem get(0) perquè getInstance de Bootstrap només accepta elements del DOM
                    modal_eliminar.hide();
                    deslogejarUsuari(true);
                    return;
                }
                $('#missatge-eliminar-compte-1').text("S'ha produït un error en eliminar el compte.").removeClass().addClass("text-danger");
                $('#missatge-eliminar-compte-2').text(`Motiu: ${error.error}`).removeClass().addClass("text-danger");
                 return;
            }

            // Si tot ha anat bé, el compte s'ha eliminat.
            deslogejarUsuari();

            // Amaguem el modal d'eliminació del compte i mostrem un altre confirmant que l'usuari s'ha eliminat correctament
            const modal_eliminar_compte = bootstrap.Modal.getInstance($('#modal-eliminar-compte').get(0)); // Fem get(0) perquè getInstance de Bootstrap només accepta elements del DOM
            modal_eliminar_compte.hide();
            $('#modal-missatge-titol').text("S'ha eliminat el teu compte d'usuari correctament").removeClass().addClass("text-normal");
            $('#modal-missatge-motiu').text("Gràcies per utilitzar el servei de la Biblioteca.").removeClass().addClass("text-normal");
            const modal_missatge = new bootstrap.Modal($('#modal-missatge'));
            modal_missatge.show();
        } catch (error) {
            console.error('Error de xarxa:', error);
            $('#missatge-eliminar-compte-1').text("S'ha produït un error en eliminar el compte.").removeClass().addClass("text-danger");
            $('#missatge-eliminar-compte-2').text("Motiu: Error de connexió amb el servidor.").removeClass().addClass("text-danger");
        }
    });

    // Formularis
    $('#form-crear-compte').on('submit', async function (event) {
        event.preventDefault(); // Permet que el formulari no s'enviï (l'acció per defecte), però així podem controlar que, per exemple,
        // l'email tingui un format d'email, gracies a type="email", gràcies al frontend
        const nom = $('#crear-nom').val().trim();
        const email = $('#crear-email').val().trim();
        const contrasenya = $('#crear-contrasenya').val().trim();
        const confirmacio = $('#crear-confirmacio').val().trim();

        // Fem una sèrie de comprovacions per si hi ha hagut algun problema amb el Frontend i aquest no ha comprovat bé el formulari
        if (!nom || !email || !contrasenya || !confirmacio) {
            $('#creacio-compte-missatge').removeClass().addClass('missatge text-danger').text('Cal omplir tots els camps.');
            return;
        }

        if (contrasenya.length < 8) {
            $('#creacio-compte-missatge').removeClass().addClass('missatge text-danger').text('La contrasenya ha de tenir, com a mínim, 8 caràcters.');
            return;
        }

        if (contrasenya !== confirmacio) {
            $('#creacio-compte-missatge').removeClass().addClass('missatge text-danger').text('La contrasenya i la confirmació de la contrasenya no coincideixen.');
            return;
        }

        try {
            const resposta = await fetch('http://localhost:8000/usuaris', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nom: nom,
                    email: email,
                    contrasenya: contrasenya,
                    confirmacio: confirmacio
                })
            });

            if (!resposta.ok) {
                const error = await resposta.json();
                 $('#creacio-compte-missatge').removeClass().addClass('missatge text-danger').text(error.error || 'Error en crear el compte.');
                 return;
            }

            // Ara l'usuari podrà iniciar sessió amb el seu nou compte
            mostrarSeccio('#seccio-inicial');
            $('#pagina-inicial-missatge').removeClass().addClass('missatge text-success').text('Compte creat correctament! Ja pots iniciar sessió amb el compte que acabes de crear');

        } catch (error) {
            console.error('Error de xarxa:', error);
            $('#creacio-compte-missatge').removeClass().addClass('missatge text-danger').text('Error de connexió amb el servidor.');
        }
    });


    $('#form-login').on('submit', async function (event) {
        event.preventDefault(); // Permet que el formulari no s'enviï (l'acció per defecte), però així podem controlar que, per exemple,
        // l'email tingui un format d'email, gràcies a type="email", gràcies al frontend
        const email = $('#login-email').val().trim();
        const contrasenya = $('#login-contrasenya').val();

        // Fem una comprovació per si hi ha hagut algun problema amb el Frontend i aquest no ha comprovat bé el formulari
        if (!email || !contrasenya) {
            $('#login-missatge').removeClass().addClass('missatge text-danger').text('Cal omplir tots els camps.');
            return;
        }

        try {
            const resposta = await fetch('http://localhost:8000/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email,
                    contrasenya: contrasenya
                })
            });

            if (!resposta.ok) {
                const error = await resposta.json();
                 $('#login-missatge').removeClass().addClass('missatge text-danger').text(error.error || 'Error en iniciar sessió.');
                 return;
            }

            // Si no hi ha hagut cap error, obtenim les dades que retorna el servidor:
            const dades = await resposta.json();
            localStorage.setItem('token', dades.token);

            usuariLogejat = dades.usuari;
            logejarUsuari();

        } catch (error) {
            console.error('Error de xarxa:', error);
            $('#login-missatge').removeClass().addClass('missatge text-danger').text('Error de connexió amb el servidor.');
        }
    });

    $('#form-modificar').on('submit', async function (event) {
        event.preventDefault(); // Permet que el formulari no s'enviï (l'acció per defecte), però així podem controlar que, per exemple,
        // l'email tingui un format d'email, gracies a type="email", gràcies al frontend
        const nom = $('#modificar-nom').val().trim();
        const email = $('#modificar-email').val().trim();
        const contrasenya = $('#contrasenya-en-modificar-perfil').val().trim();
        const token = localStorage.getItem('token');

        // Fem una sèrie de comprovacions per si hi ha hagut algun problema amb el Frontend i aquest no ha comprovat bé el formulari
        if (!nom || !email || !contrasenya) {
            $('#modificar-compte-missatge').removeClass().addClass('missatge text-danger').text('Cal omplir tots els camps.');
            return;
        }

        // Aquesta comprovació també la fa el servidor, però la fem aquí per evitar contactes innecessaris amb el servidor
        if (nom === usuariLogejat.nom && email === usuariLogejat.email) {
            $('#modificar-compte-missatge').removeClass().addClass('missatge text-warning').text("No s'ha aplicat cap canvi: el nom i email introduïts són idèntics als que estaven registrats anteriorment");
            return;
        }

        try {
            const resposta = await fetch(`http://localhost:8000/usuaris/${usuariLogejat.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({
                    nom: nom,
                    email: email,
                    contrasenya: contrasenya
                })
            });

            if (!resposta.ok) {
                const error = await resposta.json();
                if (resposta.status === 401 && 'errorToken' in error) {
                    // Llavors el token no s'ha acceptat, el que significa que la sessió no és vàlida
                    deslogejarUsuari(true);
                    return;
                }
                 $('#modificar-compte-missatge').removeClass().addClass('missatge text-danger').text(error.error || 'Error en modificar el compte.');
                 return;
            }

            // Hem de modificar la instància de l'usuari logejat
            const dades = await resposta.json();

            usuariLogejat = dades.usuari;
            $('#benvinguda-usuari').text(`Benvingut/da, ${usuariLogejat.nom}`);
            $('#perfil-nom').text(`${usuariLogejat.nom}`);
            $('#perfil-email').text(`${usuariLogejat.email}`);

            $('#nav-perfil').text(`Perfil d'usuari: ${usuariLogejat.nom}`);
            mostrarSeccio('#seccio-perfil');
            $('#perfil-missatge').removeClass().addClass('missatge text-success').text('Compte modificat correctament!');

        } catch (error) {
            // Quan es fa un fetch, el catch només captura si el servidor està apagat, no es pot accedir a ell, la URL no existeix o
            // quan, simplement, el navegador no pot contactar amb el servidor
            console.error('Error de xarxa:', error);
            $('#modificar-compte-missatge').removeClass().addClass('missatge text-danger').text('Error de connexió amb el servidor.');
        }
    });

    $('#form-canviar-contrasenya').on('submit', async function (event) {
        event.preventDefault(); // Permet que el formulari no s'enviï (l'acció per defecte), però així podem controlar que, per exemple,
        // l'email tingui un format d'email, gracies a type="email", gràcies al frontend
        const actual = $('#modificar-contrasenya-contrasenyaactual').val().trim();
        const nova = $('#modificar-contrasenya-contrasenyanova').val().trim();
        const confirmacio = $('#modificar-contrasenya-confirmacio').val().trim();
        const token = localStorage.getItem('token');

        // Fem una sèrie de comprovacions per si hi ha hagut algun problema amb el Frontend i aquest no ha comprovat bé el formulari
        if (!actual || !nova || !confirmacio) {
            $('#modificar-contrasenya-missatge').removeClass().addClass('missatge text-danger').text('Cal omplir tots els camps.');
            return;
        }

        if (nova.length < 8) {
            $('#modificar-contrasenya-missatge').removeClass().addClass('missatge text-danger').text('La nova contrasenya ha de tenir, com a mínim, 8 caràcters.');
            return;
        }

        if (nova !== confirmacio) {
            $('#modificar-contrasenya-missatge').removeClass().addClass('missatge text-danger').text("La contrasenya i la confirmació de la contrasenya no coincideixen.");
            return;
        }

        // Aquesta comprovació també la fa el servidor, però la fem aquí per evitar contactes innecessaris amb el servidor
        if (actual === nova) {
            $('#modificar-contrasenya-missatge').removeClass().addClass('missatge text-warning').text("No s'ha aplicat cap canvi: la contrasenya actual i la nova són idèntiques.");
            return;
        }

        try {
            const resposta = await fetch(`http://localhost:8000/usuaris/${usuariLogejat.id}/contrasenya`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({
                    contrasenya_actual: actual,
                    contrasenya_nova: nova
                })
            });

            if (!resposta.ok) {
                const error = await resposta.json();
                if (resposta.status === 401 && 'errorToken' in error) {
                    // Llavors el token no s'ha acceptat, el que significa que la sessió no és vàlida
                    deslogejarUsuari(true);
                    return;
                }
                 $('#modificar-contrasenya-missatge').removeClass().addClass('missatge text-danger').text(error.error || 'Error en modificar la contrasenya.');
                 return;
            }

            // Hem de modificar la instància de l'usuari logejat

            mostrarSeccio('#seccio-perfil');
            $('#perfil-missatge').removeClass().addClass('missatge text-success').text('Contrasenya modificada correctament!');

        } catch (error) {
            console.error('Error de xarxa:', error);
            $('#modificar-contrasenya-missatge').removeClass().addClass('missatge text-danger').text('Error de connexió amb el servidor.');
        }
    });
});