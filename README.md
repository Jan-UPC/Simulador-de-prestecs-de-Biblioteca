# Simulador-de-prestecs-de-Biblioteca
Projecte realitzat per a l'assignatura de Programació Multiplataforma i Distribuïda de l'EPSEVG

## Descripció
Single-Page Application que simula una biblioteca en la qual els 
usuaris poden fer préstecs de llibres. De cada llibre hi ha diferent informació, com el seu 
títol, autor o ISBN. 

Quan un usuari fa un préstec d’un llibre, té un mes per retornar-lo, i pot tenir un màxim de 
3 préstecs actius alhora. Si l’usuari té un o més préstecs sense retornar quan ja ha passat 
la seva data límit de retorn, el sistema no permetrà a l’usuari fer més préstecs fins que 
retorni tots els llibres amb préstecs retardats. L’usuari, en la aplicació, pot veure tota la 
informació dels seus préstecs, tan actius com ja retornats, i filtrar la llista perquè només 
apareguin els préstecs de llibres no retornats. 

Quan un usuari busca a la llista de llibres de la biblioteca, pot navegar per les diferents 
pàgines de la llista o, també, aplicar un filtre per categoria (només llibres de misteri, 
ficció, cuina, ...) i/o cercar per títol del llibre. 

Finalment, els usuaris poden modificar informació del seu perfil d’usuari: el seu nom, el 
seu correu electrònic, que els identifica, i la seva contrasenya. A més, si no tenen cap 
llibre prestat sense retornar, poden eliminar el seu compte, esborrant tot l’historial de 
préstecs associat a ells.

## Com utilitzar-lo?
Per executar el servidor, s'ha d'obrir el directori "server" amb una terminal i executar:

1. npm install (només una vegada)

2. node server.js (cada vegada que es vulgui encendre el servidor. Alternativa: npm start)

Per executar el client, s'ha d'accedir al directori "index.html" i obrir, fent doble click, el fitxer "index.html"
