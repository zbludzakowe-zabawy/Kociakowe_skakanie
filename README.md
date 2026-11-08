# Kociakowe skakanie 🐾

Wesoła gra zręcznościowa dla **1–4 graczy** – głównie na telefon, ale działa też na komputerze.
Każdy gracz to mały kotek, który sam biegnie od lewej do prawej. Trzeba szybko klikać, żeby kotek
podskakiwał i omijał kolce oraz kręcące się piły. Kto pierwszy dobiegnie do mety, zdobywa punkt –
kto pierwszy zbierze **8 punktów**, wygrywa całą grę.

## Jak uruchomić

Zagraj na stronie: **https://zbludzakowe-zabawy.github.io/Kociakowe_skakanie/**

To zwykła strona HTML bez żadnych zależności – można też otworzyć `index.html` w przeglądarce.
Gra publikuje się sama na GitHub Pages po każdej zmianie na `main`
(jednorazowo: Settings → Pages → Source: **GitHub Actions**).

## Aplikacja na telefon

Grę można zainstalować jak aplikację – ma wtedy własną ikonę na ekranie głównym, otwiera się
na pełnym ekranie i **działa bez internetu**.

- **Android (Chrome, Edge, Samsung):** w menu gry pojawi się baner **Zainstaluj** – albo
  ⋮ → **Zainstaluj aplikację** / **Dodaj do ekranu głównego**.
- **iPhone / iPad:** otwórz stronę w **Safari**, stuknij **Udostępnij** → **Do ekranu początkowego**
  (gra sama to podpowie).
- **Komputer (Chrome, Edge):** ikona instalacji na pasku adresu albo przycisk **Zainstaluj** w banerze.

Gra **zapamiętuje rozgrywkę**: liczbę graczy, wyniki i level. Jeśli telefon zamknie aplikację w tle
albo przeładujesz stronę, w menu pojawi się **Kontynuuj grę** (bieżący level zaczyna się od nowa
z odliczaniem). Po przeładowaniu w trakcie gry rozgrywka wraca od razu.

Gdy opublikujemy nową wersję, zainstalowana gra pokaże **„Dostępna nowa wersja”**.
**Odśwież** wczytuje ją od razu (wyniki i level zostają), **Później** – przy następnym uruchomieniu.
Gra nigdy nie przeładowuje się sama w trakcie zabawy.

## Struktura

| Plik | Co to |
|------|-------|
| `index.html`, `style.css`, `game.js` | gra |
| `manifest.webmanifest` | opis aplikacji (nazwa, kolory, ikony) |
| `icons/` | ikony aplikacji; źródło: `tools/icon/ikona.svg` |
| `sw.js` | service worker – działanie offline i aktualizacje |
| `js/pwa.js` | baner „Zainstaluj” i „Dostępna nowa wersja” |
| `tools/build-sw.mjs` | przy publikacji wpisuje do `sw.js` wersję i listę plików |
| `.github/workflows/pages.yml` | publikacja na GitHub Pages |

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
