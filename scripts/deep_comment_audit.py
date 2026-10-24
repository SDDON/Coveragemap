import json
import glob
import os
import sys

# Ensure UTF-8 output on Windows consoles
sys.stdout.reconfigure(encoding='utf-8')

# Robust repository root finder (walks up until package.json or .git is found)
def find_repo_root():
    curr = os.path.abspath(__file__)
    while True:
        parent = os.path.dirname(curr)
        if os.path.exists(os.path.join(curr, 'package.json')) or os.path.exists(os.path.join(curr, '.git')):
            return curr
        if parent == curr:
            # Fallback to 2 levels up if not found
            return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        curr = parent

REPO_ROOT = find_repo_root()
CATALOG_PATH = os.path.join(REPO_ROOT, '.agents', 'teamwork', 'explorer_m4_2', 'classified_comments_catalog.json')
SRC_DIR = os.path.join(REPO_ROOT, 'frontend', 'src')

if not os.path.exists(CATALOG_PATH):
    print(f"ERROR: Catalog not found at {CATALOG_PATH}", file=sys.stderr)
    sys.exit(2)

with open(CATALOG_PATH, encoding='utf-8') as f:
    catalog = json.load(f)

ts_files = [f for f in glob.glob(os.path.join(SRC_DIR, '**', '*'), recursive=True) if f.endswith(('.ts', '.tsx'))]
file_texts = {
    os.path.normpath(f).replace('\\', '/'): open(f, encoding='utf-8').read().replace('\r\n', '\n')
    for f in ts_files
}

print(f"Loaded {len(catalog)} catalog comments from catalog.")
print(f"Scanned {len(file_texts)} TypeScript files in frontend/src.")

completely_missing = []
partially_missing = []
exact_matches = []
all_lines_matches = []
vacuous_errors = []

for item in catalog:
    idx = item['index']
    dest = item.get('destinationModule', 'Unknown')
    raw = item.get('commentText', '').replace('\r\n', '\n').strip()
    
    # VACUOUS CHECK 1: Ensure raw text is non-empty
    if not raw:
        vacuous_errors.append((idx, "commentText is empty"))
        continue
    
    # Filter meaningful lines
    lines = [l.strip() for l in raw.splitlines()]
    # Strip comment markers (including JSX brackets {/* */})
    meaningful_lines = [l.lstrip('{/* ').rstrip('}*/ ').strip() for l in lines]
    # Filter out empty lines, single asterisks, and trivial delimiters
    meaningful_lines = [l for l in meaningful_lines if l and l != '*' and not set(l).issubset({'-', '=', '*', '/', '#'})]
    
    # VACUOUS CHECK 2: Ensure meaningful lines list is non-empty
    if not meaningful_lines:
        vacuous_errors.append((idx, "No meaningful lines extracted from commentText"))
        continue
    
    # VACUOUS CHECK 3: Ensure no meaningful line is trivial (< 4 characters)
    short_lines = [l for l in meaningful_lines if len(l) < 4]
    if short_lines:
        vacuous_errors.append((idx, f"Contains trivial/vacuous lines (< 4 chars): {short_lines}"))
        continue

    # 1. Exact full block match (including original comment syntax)
    exact_files = [f for f, t in file_texts.items() if raw in t]
    if exact_files:
        exact_matches.append((idx, exact_files))
        all_lines_matches.append((idx, exact_files))
        continue

    # 2. All meaningful lines preserved in the same file (handles indentation and comment wrapper variations)
    files_with_all = [f for f, t in file_texts.items() if all(ml in t for ml in meaningful_lines)]
    if files_with_all:
        all_lines_matches.append((idx, files_with_all))
        continue

    # 3. If neither matched, analyze line-by-line coverage
    found_lines = {}
    missing_lines = []
    for ml in meaningful_lines:
        found_in = [f for f, t in file_texts.items() if ml in t]
        if found_in:
            found_lines[ml] = found_in
        else:
            missing_lines.append(ml)

    if not found_lines:
        completely_missing.append((idx, dest, meaningful_lines))
    else:
        partially_missing.append((idx, dest, len(meaningful_lines), len(found_lines), missing_lines))

print(f"\n==========================================")
print(f"      COMMENT INTEGRITY AUDIT REPORT      ")
print(f"==========================================")
print(f"Total catalog comments:              {len(catalog)}")
print(f"Vacuous / malformed comments:        {len(vacuous_errors)}")
print(f"Exact full block matches:            {len(exact_matches)} / {len(catalog)}")
print(f"All lines preserved in same file:    {len(all_lines_matches)} / {len(catalog)}")
print(f"Partially missing (dropped lines):   {len(partially_missing)}")
print(f"Completely missing comments:         {len(completely_missing)}")

if vacuous_errors:
    print(f"\n[VACUOUS / MALFORMED CATALOG ENTRIES]")
    for idx, reason in vacuous_errors:
        print(f"  Item #{idx}: {reason}")

if completely_missing:
    print(f"\n[COMPLETELY MISSING COMMENTS]")
    for idx, dest, lines in completely_missing:
        print(f"  Item #{idx} (Expected destination: {dest}):")
        for l in lines:
            print(f"    - {l}")

if partially_missing:
    print(f"\n[PARTIALLY MISSING COMMENTS (DROPPED LINES)]")
    for idx, dest, total, found, missing in partially_missing:
        print(f"  Item #{idx} ({found}/{total} lines found; Expected destination: {dest}):")
        for m in missing:
            print(f"    MISSING: {m}")

# Enforce strict exit code
if vacuous_errors or completely_missing or partially_missing or len(all_lines_matches) != len(catalog):
    print(f"\nFAILED: Substantive comment preservation is NOT at 100% ({len(all_lines_matches)}/{len(catalog)}).")
    sys.exit(1)
else:
    print(f"\nPASSED: 100% ({len(catalog)}/{len(catalog)}) comments genuinely and substantively preserved.")
    sys.exit(0)
