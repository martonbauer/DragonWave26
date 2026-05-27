## 9. Tesztelés és Minőségbiztosítás (Bauer Márton)

### 9.1. Tesztelési stratégia és folyamat

A DragonWave 2026 rendszer minőségbiztosítási (Quality Assurance - QA) folyamata a modern szoftverfejlesztési iparág többszintű tesztelési piramisát (Testing Pyramid) követi, biztosítva a megbízható és hibamentes működést. A tesztelési folyamat három egymásra épülő pilléren nyugszik: első lépésként a tesztesetek és hibajegyek megtervezése és nyomon követése a Jira agilis projektmenedzsment felületén történik. Ezt követi a kód alapvető üzleti logikájának (pl. az időmérési és státuszkezelési matematikának) izolált, automatizált ellenőrzése a Jest keretrendszerrel (Unit Testing). Végül a rendszer egészének átfogó vizsgálatát a böngészőben végrehajtott manuális, funkcionális tesztek és a hálózati forgalom (Network Payload) fejlesztői eszközökkel történő monitorozása zárja.

A tesztelési folyamat lépései:

1. **Automatizált Egységtesztelés (Unit Testing)**: A kódolási fázisban a kritikus JavaScript modulokat (például az időeredmény-kalkulációs algoritmust) izoláltan teszteltük a Jest keretrendszerrel. Ennek célja az volt, hogy a programozási és matematikai hibákat a legalsó kódszinten kiszűrjük, még mielőtt a rendszer adatot küldene a REST API-n keresztül.
2. **Manuális Funkcionális és Integrációs Tesztelés**: A frontend felületen végrehajtottuk az előre definiált teszteseteket (TC-01, TC-02 stb.). Ennek során a következőket vizsgáltuk:
    - A JavaScript megfelelően manipulálja-e a DOM-ot a jogosultságok alapján (pl. admin felületek, módosító gombok elrejtése vagy megjelenítése).
    - A kliensoldali memória (átmeneti állapotkezelés) helyesen tárolja-e az adatokat, például offline szinkronizáció esetén.
    - A Supabase adatbázis megfelelően reagál-e a GET, POST és PATCH HTTP kérésekre.
3. **Hibakövetés (Bug Tracking) a Jirában**: Amennyiben a tesztelés során a rendszer hibára futott vagy a felhasználói élményt (UX) rontó tényezőt tapasztaltunk, a problémát dedikált „Bug” típusú jegyként rögzítettük a Jirában. A jegyek leírásában minden esetben rögzítettük a pontos hibajelenséget, valamint megjelöltük az érintett forráskódot (pl. `dragon.js` fájlt és a hibás függvényt) a célzott és gyorsabb javítás érdekében.

_(3. sz. kép - Forrás: Saját képernyőkép a Jira projektmenedzsment felületéről)_
_(4. sz. kép - Forrás: Saját képernyőkép a Jira projektmenedzsment felületéről)_
_(5. sz. kép - Forrás: Saját képernyőkép a Jira projektmenedzsment felületéről)_
_(6. sz. kép - Forrás: Saját képernyőkép a Jira projektmenedzsment felületéről)_
_(7. sz. kép - Forrás: Saját képernyőkép a Jira projektmenedzsment felületéről)_

4. **Kódjavítás és Regressziós Tesztelés**: A forráskód javítását követően a korábban már lefutott teszteket újra elvégeztük (regressziós tesztelés). Ezzel bizonyosodtunk meg arról, hogy az új kód beemelése nem rontotta el a már meglévő, stabil funkciókat. A "Code Freeze" (kódfagyasztás) állapotának elérésekor minden teszteset sikeresen (PASS) lefutott, és a Jirában az összes teszteléshez kapcsolódó jegy "Done" (Kész) státuszba került.

### 9.2. Funkcionális tesztesetek

- **TC-01 teszteset: Versenyzői nevezés tesztelése (Publikus felület).** Eredmény: A felhasználói felület (User Interface - UI) betölt. A sikeres űrlapkitöltés után az adminisztrációs módosító gombok természetesen megszorítás alatt maradnak a külső kliens számára, az adatok biztonságosan elküldésre kerülnek az adatbázisba "Pending" státusszal. A teszt sikeres.

- **TC-02 teszteset: Bejelentkezés adminisztrátori adatokkal.** Eredmény: A menedzsment oldalon (management.html) a helyes kód megadása után a fejlesztői eszközökön (Developer Tools) látható a háttérszerver (Backend) felé indított WebSocket/REST hitelesítési kérés a Hálózat (Network) fülön, és a sikeres belépést, illetve szinkronizációt igazoló üzenet a Konzolban (Console). A vezérlő gombok megjelennek. A teszt sikeres.
  _(8. sz. kép - Forrás: Saját képernyőkép a böngésző fejlesztői eszközeiről.)_

- **TC-03 teszteset: Időmérési hiba (negatív idő) szimulálása.** Eredmény: A böngészőben futó szabályrendszer (Kliensoldali üzleti logika) helyesen felismeri a kísérletet (pl. ha a beérkezés időbélyege kisebb lenne, mint a hivatalos rajtolásé), és megakadályozza a negatív idő mentését, 0 értéknél megállítva azt, vagy hibaüzenetet adva. A teszt sikeres.
  _(9. sz. kép - Forrás: Saját képernyőkép a böngésző fejlesztői eszközeiről.)_

- **TC-04 teszteset: Tömeges beérkeztetés/mentés megszakítása mobil nézetben.** Eredmény: A megerősítő felugró ablakban (Modal) a "Mégse" gombra kattintva az eltárolt részeredmények nem kerülnek feltöltésre. A memória tartalma megmarad, adatbázis-kommunikáció nem történik, a versenybíró folytathatja a gyűjtést. A teszt sikeres.
  _(10. sz. kép - Forrás: Saját képernyőkép a böngésző fejlesztői eszközeiről.)_

- **TC-05 teszteset: Tömeges rögzítés és hálózati szinkronizáció.** Eredmény: A tömeges frissítés (Bulk/Batch Update) sikeres hálózati szinkronizációja megtörtént a felhőalapú adatbázissal (Supabase). A Hálózat (Network) fülön látható az egyetlen szabványos webes kérésbe (REST API hívás) csomagolt adatcsomag (JSON Payload). A teszt sikeres.
  _(11. sz. kép - Forrás: Saját képernyőkép a böngésző fejlesztői eszközeiről.)_

### 9.3. A tesztekhez végzett kód és automatizált tesztelés

A vizsgakövetelményeknek megfelelően a manuális tesztek mellett az alapvető üzleti logika automatizált egységtesztelésen (Unit Test) is átesett a Jest tesztkörnyezet segítségével. Kiemelt fontosságú volt annak kódolt ellenőrzése, hogy a futam végleges versenyideje (eltelt milliszekundumokban) semmilyen adminisztrációs vagy hálózati elcsúszás körülményei között ne vehessen fel negatív értéket.

```javascript
// logic.js - Kliensoldali időmérés logika
function calculateElapsedTime(startTime, endTime) {
    const elapsed = endTime - startTime;
    return elapsed < 0 ? 0 : elapsed; // Ha negatív alá menne (hibás adatpár), akkor 0-t ad vissza
}
module.exports = { calculateElapsedTime };
```

Az automatizált teszt kódja (Jest framework):

```javascript
// logic.test.js
const { calculateElapsedTime } = require('./logic');

describe('Versenyidő kalkulációs tesztek', () => {
    test('TC-03 Kódolt teszt: Az eltelt idő nem mehet nulla alá', () => {
        const eredmeny = calculateElapsedTime(10000, 5000); // Hibás adatok: célidő kisebb a rajtnál
        expect(eredmeny).toBe(0);
    });

    test('TC-04 Kódolt teszt: Helyes versenyidő számítás', () => {
        const eredmeny = calculateElapsedTime(2000, 10000); // 8 mp telt el
        expect(eredmeny).toBe(8000);
    });

    test('TC-05 Kódolt teszt: Hosszabb táv beérkeztetési tesztje', () => {
        const eredmeny = calculateElapsedTime(50000, 200000); // 150 mp telt el
        expect(eredmeny).toBe(150000);
    });
});
```

_(12. sz. kép - Forrás: Sikeres Jest egységteszt lefutása a fejlesztői terminálban)_

**Teszteredmények dokumentációja:**
Az `npm test` parancs futtatásakor a rendszer mindhárom fenti tesztesetet sikeresen (PASS) értékelte, igazolva az üzleti logika stabilitását az adatbázisba történő írás előtt.
