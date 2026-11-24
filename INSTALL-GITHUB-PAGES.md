# Εγκατάσταση με GitHub Pages (δωρεάν, χωρίς credits)

Το GitHub Pages φιλοξενεί το φάκελο `site/` δωρεάν. Κάθε `git push` στο `main` ανεβάζει αυτόματα νέα έκδοση μέσω GitHub Actions (workflow: `.github/workflows/pages.yml`). Δεν υπάρχει όριο deploys.

Το link θα έχει τη μορφή: `https://<χρήστης>.github.io/<repo>/`
Για αυτό το repo: **https://techiereviewstuts.github.io/Super-Market-Cost/**

## Α. Δικό σου αντίγραφο (fork)
1. Μπες στο GitHub και πάτα **Fork** στο repo `Super-Market-Cost` (το repo πρέπει να είναι **public** για δωρεάν Pages).
2. Πήγαινε στο fork σου → **Settings → Pages**.
3. Στο **Build and deployment → Source** διάλεξε **GitHub Actions**.
4. Πήγαινε στο tab **Actions**. Αν ζητήσει, πάτα *I understand my workflows, go ahead and enable them*, άνοιξε το workflow **Deploy to GitHub Pages** και πάτα **Run workflow**.
5. Σε ~1 λεπτό το link εμφανίζεται στο **Settings → Pages** (και στο run του workflow).

## Β. Ρύθμιση Google Drive για το νέο link
Στο Google Cloud Console → **Credentials** → το OAuth client σου → **Authorized JavaScript origins** → *Add URI*:

`https://<χρήστης>.github.io`

Προσοχή: **μόνο το domain**, χωρίς το όνομα του repo και χωρίς `/` στο τέλος. Πάτα **Save** (η αλλαγή μπορεί να κάνει λίγα λεπτά). Αν χρησιμοποιείς δικό σου Client ID, βάλ' το στην εφαρμογή: *Ρυθμίσεις → Google Client ID*.

## Γ. Εγκατάσταση στο Android
1. Άνοιξε το link του GitHub Pages στο **Chrome**.
2. Μενού **⋮ → Εγκατάσταση εφαρμογής**.
3. *Ρυθμίσεις → Σύνδεση με Google → Αντίγραφο τώρα*.

## Δ. Μεταφορά δεδομένων από το Netlify (ή από άλλο link)
Ο browser κρατά τα δεδομένα ξεχωριστά για κάθε διεύθυνση, άρα το νέο link ξεκινά άδειο.
1. Στην **παλιά** εφαρμογή: *Ρυθμίσεις → Αντίγραφο τώρα* (ή **Εξαγωγή JSON**).
2. Στη **νέα**: *Σύνδεση με Google → Επαναφορά από Drive* (ή **Εισαγωγή JSON**).
3. Αφαίρεσε την παλιά εφαρμογή από το κινητό.

## Ε. Ενημέρωση
```bash
git add -A
git commit -m "περιγραφή αλλαγής"
git push
```
Το workflow τρέχει μόνο του (δες το tab **Actions**). Στο κινητό κλείσε εντελώς την εφαρμογή και άνοιξέ την ξανά.

## Συχνά προβλήματα
| Πρόβλημα | Λύση |
|---|---|
| 404 στο link | Έλεγξε ότι το **Source** είναι *GitHub Actions* και ότι το τελευταίο run στο Actions είναι πράσινο. |
| Το workflow δεν τρέχει | Στο fork ενεργοποίησε τα Actions (βήμα Α4). |
| `origin mismatch` στη σύνδεση Google | Το origin πρέπει να είναι ακριβώς `https://<χρήστης>.github.io`. |
| Δεν αλλάζει η έκδοση στο κινητό | Κλείσε την εφαρμογή εντελώς και άνοιξέ την ξανά. |

## Netlify ή GitHub Pages;
Επίλεξε **ένα** για καθημερινή χρήση. Δύο ξεχωριστά sites σημαίνουν δύο ξεχωριστές βάσεις δεδομένων στο κινητό και διπλή ενημέρωση. Οδηγίες για Netlify: δες το [README](README.md#οδηγίες-εγκατάστασης-βήμα-βήμα).
