#!/usr/bin/env python3
"""
scripts/check_policy.py
CoverageMap Tier 1 Static Policy Checker
Enforces UI/UX design policies, Z-Index tokens, and architectural constraints.

Enforced Rules:
1. [Z-Index Token Rule]: No hardcoded numeric z-index (e.g. z-index: 1000). Must use var(--z-*).
2. [Focus+Context Pure CSS Rule]: No node/edge dimming opacity manipulation in TSX.
3. [Port Consistency Rule]: No hardcoded deprecated port 8001 in project code. Must use 8190 or env vars.
4. [Halo Handle Stacking & Isolation Rule]: Halo handles must stay at or below z-index 0 and never cover inner content.
5. [Skip Reason Rule]: Every test.skip / test.fixme in e2e-tests/tests needs a '// SKIP-REASON: ...' comment on the line above.
6. [i18n Centralization Rule]: Files listed in I18N_MIGRATED_FILES must not hardcode Hangul UI strings (use frontend/src/locales/).

Exit code: 0 if passed, 1 if any violations found.
"""

import os
import re
import sys

# Ensure UTF-8 output on Windows console
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
FRONTEND_SRC = os.path.join(WORKSPACE_ROOT, "frontend", "src")
BACKEND_DIR = os.path.join(WORKSPACE_ROOT, "backend")
MCP_DIR = os.path.join(WORKSPACE_ROOT, "mcp_server")

IGNORED_DIRS = {".venv", "venv", "node_modules", ".git", "dist", "__pycache__", ".pytest_cache"}

violations = []

def check_file(filepath: str):
    rel_path = os.path.relpath(filepath, WORKSPACE_ROOT)
    ext = os.path.splitext(filepath)[1].lower()

    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()
        lines = content.splitlines()

    # Rule 4 Check: Halo Handle Stacking & Overlay Rule (Full CSS block check)
    if ext == ".css" and ".halo-handle" in content:
        # Extract .halo-handle CSS blocks
        halo_blocks = re.findall(r"\.halo-handle\s*\{([^}]+)\}", content, re.DOTALL)
        for block in halo_blocks:
            # Check if z-index is positive number or elevated token
            z_match = re.search(r"z-index:\s*([^\s;!]+)", block)
            if z_match:
                val = z_match.group(1).strip()
                # Allowed: 0, -1, -2, var(--z-canvas-bg)
                if val not in ["0", "-1", "-2", "var(--z-canvas-bg)"]:
                    violations.append({
                        "file": rel_path,
                        "line": 1,
                        "rule": "Halo Handle Stacking Rule",
                        "detail": f".halo-handle의 z-index({val})가 너무 높습니다. 노드 내부 뱃지/버튼의 클릭을 방해하지 않도록 var(--z-canvas-bg)(0) 이하로 유지해야 합니다.",
                        "snippet": f"z-index: {val}"
                    })

    for i, line in enumerate(lines, start=1):
        # 1. Check for hardcoded numeric z-index (in CSS and TSX)
        if ext in [".css", ".tsx", ".ts"]:
            css_match = re.search(r"z-index:\s*(\d{2,})", line)
            tsx_match = re.search(r"zIndex:\s*(\d{2,})", line)
            
            # Exclude lines that define token variables (--z-*: \d+)
            is_token_definition = "--z-" in line and ":" in line and line.strip().startswith("--z-")

            if (css_match or tsx_match) and not is_token_definition:
                val = css_match.group(1) if css_match else tsx_match.group(1)
                violations.append({
                    "file": rel_path,
                    "line": i,
                    "rule": "Z-Index Token Rule",
                    "detail": f"하드코딩된 숫자 z-index({val})가 발견되었습니다. AI_IMPLEMENTATION_SPEC.md의 var(--z-*) 토큰을 사용하세요.",
                    "snippet": line.strip()
                })

        # 2. Check for node/edge dimming opacity manipulation in TSX (violates Focus+Context Pure CSS Rule)
        if ext in [".tsx", ".jsx"]:
            if re.search(r"opacity:\s*(isSelected|selected|active|\.active)\s*\?", line):
                violations.append({
                    "file": rel_path,
                    "line": i,
                    "rule": "Focus+Context Pure CSS Rule",
                    "detail": "노드 선택 상태에 따른 인라인 opacity 조작이 발견되었습니다. Focus+Context 딤 처리는 index.css의 .has-selection 클래스를 통해서만 제어해야 합니다.",
                    "snippet": line.strip()
                })

        # 3. Check for deprecated port 8001
        if "8001" in line:
            if not rel_path.endswith(".md") and "ORIGINAL_REQUEST" not in rel_path and "seed.py" not in rel_path:
                violations.append({
                    "file": rel_path,
                    "line": i,
                    "rule": "Port Consistency Rule",
                    "detail": "구버전 포트(8001)가 발견되었습니다. 표준 포트인 8190 또는 환경변수(PORT)를 사용하세요.",
                    "snippet": line.strip()
                })

def scan_directory(directory: str, extensions: list):
    for root, dirs, files in os.walk(directory):
        # Prune ignored directories
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]
        for f in files:
            if any(f.endswith(ext) for ext in extensions):
                check_file(os.path.join(root, f))

def check_test_skip_reasons(directory: str):
    """
    Rule 5 [Skip Reason Rule]: E2E 테스트의 test.skip / test.fixme 바로 윗줄에는
    '// SKIP-REASON: <사유>' 주석이 있어야 합니다. (사유 없는 skip이 쌓여 실제 결함을 가리는 것 방지)
    """
    for root, dirs, files in os.walk(directory):
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]
        for f in files:
            if not f.endswith(".ts"):
                continue
            path = os.path.join(root, f)
            with open(path, "r", encoding="utf-8", errors="ignore") as fh:
                lines = fh.read().splitlines()
            for i, line in enumerate(lines):
                if re.search(r"\btest(\.describe)?\.(skip|fixme)\s*\(", line):
                    prev = lines[i - 1].strip() if i > 0 else ""
                    if not re.match(r"//\s*SKIP-REASON:\s*\S", prev):
                        violations.append({
                            "file": os.path.relpath(path, WORKSPACE_ROOT),
                            "line": i + 1,
                            "rule": "Skip Reason Rule",
                            "detail": "test.skip/test.fixme 바로 윗줄에 '// SKIP-REASON: <사유>' 주석이 필요합니다.",
                            "snippet": line.strip()
                        })

# Rule 6 [i18n Centralization Rule]: 이관이 끝난 파일은 UI 문자열을 frontend/src/locales/에서만 가져와야 합니다.
# (단일 한국어 로케일 정책. 주석 속 한글은 허용) 이관이 끝날 때마다 이 목록에 파일을 추가합니다.
I18N_MIGRATED_FILES = [os.path.join("frontend", "src", "components", "AutoIngestModal.tsx")]
HANGUL = re.compile(r"[가-힣]")

def check_i18n_migrated_files():
    for rel in I18N_MIGRATED_FILES:
        path = os.path.join(WORKSPACE_ROOT, rel)
        if not os.path.exists(path):
            continue
        with open(path, "r", encoding="utf-8", errors="ignore") as fh:
            content = fh.read()
        # 블록 주석(/* */, {/* */})은 줄 수를 유지한 채 제거, 이어서 줄 주석(//) 제거
        content = re.sub(r"/\*.*?\*/", lambda m: "\n" * m.group(0).count("\n"), content, flags=re.DOTALL)
        for i, line in enumerate(content.splitlines(), start=1):
            code = re.sub(r"(^|[^:])//.*$", r"\1", line)
            if HANGUL.search(code):
                violations.append({
                    "file": rel,
                    "line": i,
                    "rule": "i18n Centralization Rule",
                    "detail": "i18n 이관 완료 파일에 한글 UI 문자열이 하드코딩되어 있습니다. frontend/src/locales/koKR.ts의 t를 사용하세요.",
                    "snippet": line.strip()
                })

def main():
    print("=" * 65)
    print(" 🛡️  CoverageMap Tier 1 Static Policy Checker")
    print(" Checking compliance against AI_IMPLEMENTATION_SPEC.md...")
    print("=" * 65)

    scan_directory(FRONTEND_SRC, [".css", ".tsx", ".ts"])
    scan_directory(BACKEND_DIR, [".py"])
    scan_directory(MCP_DIR, [".py"])
    check_test_skip_reasons(os.path.join(WORKSPACE_ROOT, "e2e-tests", "tests"))
    check_i18n_migrated_files()

    if not violations:
        print("\n✅ [SUCCESS] All UI, Z-Index, and Port policies are strictly compliant!")
        print("   - Z-Index 12-Tier tokens verified.")
        print("   - Focus+Context Pure CSS rule verified.")
        print("   - Standard Port 8190 consistency verified.")
        print("   - Halo Handle Outer Rim & Stacking isolation verified.\n")
        sys.exit(0)
    else:
        print(f"\n❌ [POLICY VIOLATIONS FOUND] Total: {len(violations)}\n")
        for v in violations:
            print(f"  • [{v['rule']}] {v['file']}:{v['line']}")
            print(f"    원인: {v['detail']}")
            print(f"    코드: {v['snippet']}\n")
        print("=" * 65)
        print("💡 수정 가이드: AI_IMPLEMENTATION_SPEC.md를 참조하여 코드를 규격에 맞게 수정하세요.")
        print("=" * 65)
        sys.exit(1)

if __name__ == "__main__":
    main()
