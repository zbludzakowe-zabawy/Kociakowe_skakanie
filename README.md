# Kociakowe skakanie 🐾

Wesoła gra zręcznościowa dla **1–4 graczy** – głównie na telefon, ale działa też na komputerze.
Każdy gracz to mały kotek, który sam biegnie od lewej do prawej. Trzeba szybko klikać, żeby kotek
podskakiwał i omijał kolce oraz kręcące się piły. Kto pierwszy dobiegnie do mety, zdobywa punkt –
kto pierwszy zbierze **8 punktów**, wygrywa całą grę.

## Jak uruchomić

To zwykła strona HTML bez żadnych zależności – wystarczy otworzyć `index.html` w przeglądarce
albo wystawić folder przez dowolny serwer (np. GitHub Pages).

## Gracze i sterowanie

| Gracz | Kolor     | Róg ekranu (telefon) | Klawisz (komputer) |
|-------|-----------|----------------------|--------------------|
| 1     | turkusowy | lewy górny           | `Q`                |
| 2     | różowy    | lewy dolny           | `Z`                |
| 3     | fioletowy | prawy górny          | `P`                |
| 4     | czerwony  | prawy dolny          | `M`                |

- Na telefonie w rogach ekranu są półkola z łapkami – klikaj w swoją, żeby kotek podskoczył
  (działa wielodotyk, więc kilka osób może grać na jednym telefonie). Najlepiej trzymać telefon poziomo.
- Na komputerze trzeba **wciskać** klawisz – przytrzymanie nic nie daje.
- `Esc` lub przycisk ❚❚ – pauza.

## Zasady

- Wszystkie kotki biegną naraz po tej samej mapie, widocznej dla wszystkich.
- Gdy nie klikasz, kotek spada na podłogę.
- Kolce na suficie i podłodze oraz piły są groźne – po zderzeniu kotek nie może się ruszać
  przez 1 sekundę. Potem rusza dalej i (lekko przyspieszając) dogania pozostałych.
- Kto pierwszy dobiegnie do mety, zdobywa punkt. Następnie odliczanie **3‑2‑1‑0** i na „0” wszyscy
  startują w kolejnym levelu.
- Z każdym levelem mapa jest dłuższa, kotki szybsze, a przeszkód więcej: od 3. levelu piły jeżdżą
  góra‑dół, od 4. pojawiają się „bramki” z dwóch pił, od 6. tunele z kolcami.
- Po zdobyciu 8 punktów można grać **kolejne levele** (nowa rozgrywka do 8 punktów od
  następnego, trudniejszego levelu), **zacząć od nowa** albo **zakończyć**.
