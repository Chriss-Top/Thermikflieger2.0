# Thermikflieger 2.0

Ein atmosphärisches Segelflugspiel für den Desktop-Browser. Du startest per Winde, suchst Thermik
und Hangaufwind, bleibst so lange wie möglich oben – und landest am besten sicher auf einem Flugplatz.

**Starten:** `index.html` per Doppelklick öffnen. Es braucht keinen Server, keine Installation und kein Internet.

## Steuerung

| Taste | Funktion |
|---|---|
| `←` `→` / `A` `D` | Querlage, Kurve – immer aus Sicht des Piloten (Schräglage bleibt beim Loslassen stehen) |
| `↑` / `W` | Drücken: Nase runter, Fahrt aufnehmen |
| `↓` / `S` | Ziehen: Nase hoch, Fahrt abbauen |
| `Leertaste` | Bremsklappen, beim Windenstart: früh ausklinken |
| `Enter` / `X` | beim Windenstart: Start überspringen und direkt in 300 m über Grund beginnen |
| `P` / `Esc` | Pause (`R` neu starten, `Q` Hauptmenü) |
| `M` | Ton / Variometer an und aus |
| `F` | Vollbild |
| `Enter` | Start / nochmal fliegen |

Alle Tasten wirken aus Sicht des Piloten, egal in welche Richtung das Flugzeug gerade fliegt. `→` leitet
also immer eine Rechtskurve ein: Fliegt das Flugzeug nach rechts, kommt es dabei auf den Betrachter zu.
Das Höhenruder folgt der Steuerknüppel-Logik (↑ = drücken). Im Menü lässt es sich umkehren.

## Spielablauf

1. **Flugzeug wählen.** K8, ASK 21, LS4 und LS8 unterscheiden sich in Mindestfahrt, Gleitzahl,
   Wendigkeit und Abrissverhalten.
2. **Windenstart:** Das Flugzeug rollt an und hebt ab. Danach hältst du die Nase im grünen Band des
   künstlichen Horizonts und die Flügel gerade. Je sauberer die Lage, desto höher klinkst du aus.
3. **Thermik:** Unter Cumuluswolken, bei kreisenden Vögeln und dort, wo helle Pollen aufsteigen, steigt die Luft.
   Kreisen, auf das Variometer hören und den Kern zentrieren. Ein Flügel, der angehoben wird, zeigt zum stärkeren Aufwind.
4. **Hangaufwind:** Weht der Wind gegen einen Hang, trägt die Luvseite. Im Lee sinkt die Luft, dort ist es turbulent.
5. **Landen:** Flugplätze tauchen alle paar Kilometer auf. Flach, langsam (etwa 1,4 × Mindestfahrt) und mit
   geraden Flügeln aufsetzen. Gegenwind verkürzt die Landestrecke. Wiesen und Felder taugen für eine
   Außenlandung, Wald, Dörfer und steile Hänge nicht.

Gewertet werden Flugzeit, Strecke, maximale Höhe und die Landung. Eine Landung auf einem fremden Platz gibt
einen Bonus. Bei Bruch wird die Punktzahl halbiert. Der Bestwert wird pro Flugzeug im Browser gespeichert.

## Technik in Kürze

- **Reines HTML/CSS/JavaScript mit Canvas 2D**, klassische `<script>`-Tags, keine Frameworks, kein Backend.
- **2,5D-Perspektive** (`js/render.js`): Die Welt ist dreidimensional (x = Strecke, y = Höhe, z = Tiefe).
  Eine leicht erhöhte Perspektivkamera steht seitlich vor dem Flugkorridor. Die Landschaft entsteht aus
  Tiefenbändern mit Feldern, Wald und Dörfern, mit Lichtschattierung und Dunst. Das Flugzeug
  (`js/aircraft.js`) ist ein beleuchtetes 3D-Polygonmodell. Weil es einen echten Kurs in der x/z-Ebene
  fliegt, wird jeder Kreis von selbst zur perspektivischen Ellipse.
- **Flugphysik** (`js/physics.js`): Punktmasse mit Energieerhaltung, Parabelpolare (Sinken wächst mit n²),
  Trimmgeschwindigkeit und einem Dämpfer, der die Fahrtschwingung (Phygoide) abbaut.
  Der **Strömungsabriss** hängt am Auftriebsbeiwert und kommt deshalb in der Kurve früher (Mindestfahrt × √n).
  Vorher warnen Schütteln, Hupe, rote Vignette und eine wandernde Marke am Fahrtmesser. Erst nach
  einer flugzeugabhängigen Gnadenfrist reißt die Strömung ab: Die Nase kippt, ein Flügel kann abkippen,
  und abfangen lässt sich das Flugzeug erst nach Nachdrücken und neuer Fahrt.
- **Welt** (`js/world.js`): prozedurales Gelände mit Hügelzügen, Flugplätzen und Dörfern, Thermikblasen mit
  Lebenszyklus (Wolke wächst und zerfällt), Wind mit wechselnder Richtung und Stärke, Höhenprofil und Böen.
  Der Hangaufwind ergibt sich aus Wind × geglätteter Hangneigung und wird mit der Höhe über Grund schwächer.
- **Ton** (`js/audio.js`): WebAudio-Variometer (Piepen beim Steigen), Fahrtwind, Überziehhupe,
  Buffeting und Windenmotor.

## Dateien

```
index.html        Einstieg, Menüs (DOM)
css/style.css     Gestaltung der Menüs
js/util.js        Mathe, Rauschen, Zufall, Speicher
js/aircraft.js    Flugzeugtypen, 3D-Modelle, Darstellung
js/world.js       Gelände, Landnutzung, Wind, Thermik, Hangaufwind
js/physics.js     Flugmodell, Windenstart, Ausrollen
js/sprites.js     vorgerenderte Wolken, Bäume, Häuser
js/render.js      Kamera, Himmel, Landschaft, Objekte, Partikel
js/hud.js         Instrumente, Anzeigen, Streckenprofil, Meldungen
js/audio.js       Ton
js/game.js        Spielablauf, Eingabe, Landungsbewertung, Highscore
```
