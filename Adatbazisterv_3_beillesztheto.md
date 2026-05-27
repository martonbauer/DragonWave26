# 3. Adatbázisterv

## 3.1 Entitások, kapcsolatok

A DragonWave 2026 rendszer egy relációs adatbázist (Supabase / PostgreSQL) alkalmaz. A folyamatok logikáját az alábbi főbb entitások és azok kapcsolatai térképezik fel:

- **Registrations (Nevezések):** Az alapvető versenyzői adatokat, kapcsolattartási információkat és kategória-besorolást tartja nyilván. Ez az alapentitás (független tábla), melyhez az összes többi adat kapcsolódik.
- **Race_Timing (Időmérés):** A verseny közben mért teljesítményt és a pontos időeredményeket rögzíti.
    - _Kapcsolat:_ **1:1** viszonyban áll a Nevezésekkel (minden regisztrált versenyzőnek egy dedikált versenyideje/futása van).
- **Checkpoints (Fizikai ellenőrzőpontok / Naplózó tábla):** A különböző mérőpontokon (pl. 11km-es forduló, cél) áthaladó hajók kronológiai érintési logjait rögzíti, ezzel biztosítva az időmérés adatbiztonságát (auditor funkció).
    - _Kapcsolat:_ **1:N (Egy a többhöz)** viszony a Nevezésekkel (egy versenyző a verseny folyamán több mérőpontot is érint).
- **Payments (Fizetések):** A Barion bankkártyás befizetési tranzakciókat és azok állapotait kezeli.
    - _Kapcsolat:_ **1:1** viszony a Nevezésekkel.

## 3.2 Adattípusok, kulcsok, kapcsolat-táblák, Validációk

Az adatok egységességét, biztonságát és a GDPR megfelelést szigorú adatvédelmi és formai validációk (Backend API & Adatbázis szinten) biztosítják.

**Kulcsok és Kapcsolati logikák:**

- **Elsődleges kulcsok (Primary Keys - PK):** Minden táblában véletlenszerűen generált `UUID` (Universally Unique Identifier) működik PK-ként. Ez megakadályozza az enumerációs (sorszám alapú) adatbázis támadásokat.
- **Idegen kulcsok (Foreign Keys - FK):** A `race_timing`, `checkpoints` és `payments` táblák a saját `registration_id` mezőjük alapján CASCADE UPDATE/DELETE szabállyal kötődnek a `registrations` tábla `id` (PK) elsődleges kulcsához. Gyakorlatban: egy versenyző törlése automatikusan eltünteti a hozzá kötődő időmérési és egyéb részadatokat.

**Adattípusok és Főbb Validációk:**

1. **Registrations (Nevezések) tábla:**
    - `full_name` (VARCHAR): Kötelező kitölteni, a rendszer minimum 3 karakter hosszú, valós neveket enged be.
    - `email` (VARCHAR): Egyedi megszorítással (UNIQUE), a backend reguláris kifejezéssel validálja a valós RFC formátumot (*valami@domain.com*).
    - `birth_date` (DATE): Kötelező dátumtípus. A nevezési folyamat során a rendszer ebből validálja, hogy a versenyző életkora megfelel-e a kiválasztott kategória (pl. U18) szabályainak.
    - `category` (VARCHAR): Kategória-specifikáció (pl. "Női 22km", "Férfi 10km"), csak a kiírásban szereplő enum-értékeket fogadja el.
    - `status` (VARCHAR): Alapértelmezett értéke 'pending' (várakozik), utána admin felületről változhat 'present' (megjelent) státuszra.

2. **Race_Timing (Időmérés) tábla:**
    - `status` (VARCHAR): A versenyző állapota a pályán (enum: 'pending', 'racing', 'finished', 'dns').
    - `start_time`, `checkpoint_time`, `end_time` (TIMESTAMP WITH TIME ZONE): Dátumot és időpontot ezredmásodperc (ms) pontossággal rögzítő mezők. Szigorú validáció védi, hogy `end_time` dátuma chronológiailag nem lehet régebben mérve, mint az ehhez a rekordhoz tartozó `start_time`.

3. **Checkpoints (Forgalom napló) tábla:**
    - `milestone` (VARCHAR): Megálló azonosítója (pl. '11km-turn').
    - `timestamp` (TIMESTAMP): Az érintés rögzítésének milliszekundum pontosságú ideje.
    - `recorded_by` (VARCHAR): Melyik adminisztrátor/eszköz hagyta jóvá a mérést, adatvédelmi auditori szempontok miatt elengedhetetlen.

4. **Payments (Fizetési gateway) tábla:**
    - `barion_tid` (VARCHAR): Tranzakció azonosító token.
    - `amount` (INTEGER): Az összeg (kötelező pozitív és nullánál nagyobb érték).
    - `status` (VARCHAR): 'Succeeded', 'Failed', 'Pending'.

## 3.3 ER diagram készítése

Az adatbázis logikai (ER - Entity Relationship) tervét és az entitások 1:1, 1:N kapcsolati viszonyrendszereit az alábbi vizualizáció tartalmazza.

_(A közvetlenül Word fájlba vagy vizsgaremek dokumentációba másolható / beilleszthető diagram az **`er_diagram.png`** néven generálásra és lementésre került a Mappa gyökerébe!)_

![Adatbázis ER Diagram](file:///c:/Users/bauer/Desktop/dargonwave2026_kovetelmenyek_elott/er_diagram.png)

## 3.4 REST API Végpontok (Endpoints)

A backend és a kliens közötti kommunikációt, valamint az adatbázis tranzakciókat a következő Node.js (Express.js) végpontok menedzselik. A HTTP szerver a hagyományos RESTful API elvek mellett WebSockets (`socket.io`) réteget is használ a valós idejű szinkronizációhoz:

| Végpont (URL azonosító) | HTTP Metódus | Jogosultság | Adatbázis érintettség és Funkció                                                     |
| ----------------------- | :----------: | :---------: | ------------------------------------------------------------------------------------ |
| `/api/login`            |   **POST**   | Felhasználó | Adminisztrátori hitelesítés (Jelszó validáció).                                      |
| `/api/health`           |   **GET**    | Felhasználó | Rendszerállapot és Supabase szerver kapcsolat stabilitásának ellenőrzése.            |
| `/api/data`             |   **GET**    | Felhasználó | Valós idejű lekérés: Regisztrált versenyzők, kategóriák és mérőpont adatok.          |
| `/api/register`         |   **POST**   | Felhasználó | Új versenyző/csapat beszúrása (`racers`, `members`), duplikációk szűrésével.         |
| `/api/barion/payment`   |   **POST**   | Felhasználó | Külső 3rd Party API (Barion) hívás. Tranzakció generálása.                           |
| `/api/start-category`   |   **POST**   |  **Admin**  | Kategória szintű tömegrajt indítása és a `start_time` időbélyegző kiosztása.         |
| `/api/start-individual` |   **POST**   |  **Admin**  | Egyéni (szeparált) indítás a késő/külön induló hajóknak.                             |
| `/api/stop-racer`       |   **POST**   |  **Admin**  | Egyetlen hajó megállítása: Célidő (`end_time`) és összesített idő rögzítése.         |
| `/api/stop-bulk-racers` |   **POST**   |  **Admin**  | Tömeges beérkeztetés: Batch API, mely az azonos időben beesőket interpolálja.        |
| `/api/checkpoint`       |   **POST**   |  **Admin**  | Fizikai ellenőrzőponton (pl. 22km féltáv) áthaladás logolása auditori jelleggel.     |
| `/api/racer/:id`        |   **PUT**    |  **Admin**  | Meglévő versenyző (`racers` + `members`) adatainak inline módosítása.                |
| `/api/racer/:idOrBib`   |  **DELETE**  |  **Admin**  | Versenyző törlése (Az idegen kulcsok CASCADE szabálya miatt minden idő is törlődik). |
| `/api/upload-csv`       |   **POST**   |  **Admin**  | Tömeges CSV (Excel) importálás az adatbázisba párhuzamos Promise feldolgozással.     |
| `/api/reset`            |   **POST**   |  **Admin**  | Fejlesztői Hard Reset: A teljes adatbázis kiürítése tesztelések után.                |
