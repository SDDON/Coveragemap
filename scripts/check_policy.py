#!/usr/bin/env python3
"""
scripts/check_policy.py
CoverageMap Tier 1 Static Policy Checker
Enforces UI/UX design policies, Z-Index tokens, and architectural constraints.

Enforced Rules:
1. [Z-Index Token Rule]: No hardcoded numeric z-index (e.g. z-index: 1000, zIndex: 1). Must use var(--z-*).
2. [Focus+Context Pure CSS Rule]: No node/edge dimming or selection opacity/boxShadow manipulation in TSX.
3. [Port Standardization Rule]: Standard port 8190 with env fallback (PORT/BACKEND_PORT). Deprecated 8001 banned.
4. [Halo Handle Stacking & Isolation Rule]: Halo handles must stay at or below z-index 0 and never cover inner content.
5. [Parent Scale Immutability Rule]: Parent/node styling must NEVER use transform: scale to protect Subflow coordinates.
6. [Skip Reason Rule]: Every test.skip / test.fixme in e2e-tests/tests needs a '// SKIP-REASON: ...' comment on the line above.
7. [i18n Centralization Rule]: No hardcoded Hangul UI strings in frontend/src (except frontend/src/locales/). Comments are allowed.

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
FRONTEND_DIR = os.path.join(WORKSPACE_ROOT, "frontend")
FRONTEND_SRC = os.path.join(FRONTEND_DIR, "src")
BACKEND_DIR = os.path.join(WORKSPACE_ROOT, "backend")
MCP_DIR = os.path.join(WORKSPACE_ROOT, "mcp_server")

IGNORED_DIRS = {".venv", "venv", "node_modules", ".git", "dist", "__pycache__", ".pytest_cache"}

violations = []

def strip_comments(line: str, ext: str) -> str:
    """Strip single-line comments from line to avoid false positives in comments."""
    if ext in [".ts", ".tsx", ".js", ".jsx"]:
        # Strip // comments (preserving http:// or https://)
        return re.sub(r"(^|[^:])//.*$", r"\1", line)
    elif ext == ".py":
        # Strip # comments (except shebang / encoding)
        return re.sub(r"(^|[^:])#.*$", r"\1", line)
    elif ext == ".css":
        # Strip single-line /* ... */ comments
        return re.sub(r"/\*.*?\*/", "", line)
    return line

def check_file(filepath: str):
    rel_path = os.path.relpath(filepath, WORKSPACE_ROOT).replace("\\", "/")
    ext = os.path.splitext(filepath)[1].lower()

    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()
        lines = content.splitlines()

    # ── Rule 4: Halo Handle Stacking & Isolation Rule (Full CSS block check) ──
    if ext == ".css" and ".halo-handle" in content:
        halo_blocks = re.findall(r"\.halo-handle\s*\{([^}]+)\}", content, re.DOTALL)
        for block in halo_blocks:
            z_match = re.search(r"z-index:\s*([^\s;!]+)", block)
            if z_match:
                val = z_match.group(1).strip()
                if val not in ["0", "-1", "-2", "var(--z-canvas-bg)"]:
                    violations.append({
                        "file": rel_path,
                        "line": 1,
                        "rule": "Halo Handle Stacking Rule",
                        "detail": f".halo-handle의 z-index({val})가 너무 높습니다. 노드 내부 뱃지/버튼의 클릭을 방해하지 않도록 var(--z-canvas-bg)(0) 이하로 유지해야 합니다.",
                        "snippet": f"z-index: {val}"
                    })

    # ── Rule 5: Parent Scale Immutability Rule (CSS Block Check) ──
    if ext == ".css":
        node_css_blocks = re.findall(r"((?:\.react-flow__node|\.custom-node)[^{]*)\{([^}]+)\}", content)
        for selector, block in node_css_blocks:
            # Exclude handle or button nested classes
            if any(exempt in selector for exempt in [".react-flow__handle", ".collapse-btn", ".custom-marker-path"]):
                continue
            scale_match = re.search(r"transform:\s*[^;}]*scale\s*\(", block)
            if scale_match:
                violations.append({
                    "file": rel_path,
                    "line": 1,
                    "rule": "Parent Scale Immutability Rule",
                    "detail": f"노드 스타일({selector.strip()})에 transform: scale이 사용되었습니다. 부모 노드 좌표계 보호를 위해 box-shadow만 사용해야 합니다.",
                    "snippet": scale_match.group(0).strip()
                })

    for i, line in enumerate(lines, start=1):
        code = strip_comments(line, ext)
        if not code.strip():
            continue

        # ── Rule 1: Z-Index Token Rule (CSS and TS/TSX) ──
        if ext in [".css", ".tsx", ".ts", ".js", ".jsx"]:
            is_token_definition = "--z-" in code and ":" in code and code.strip().startswith("--z-")
            if not is_token_definition:
                # Catch ANY numeric literal assigned to z-index or zIndex (including 0-9)
                css_match = re.search(r"\bz-index:\s*(-?\d+)", code)
                tsx_match = re.search(r"\bzIndex:\s*['\"]?(-?\d+)['\"]?", code)
                if css_match or tsx_match:
                    val = css_match.group(1) if css_match else tsx_match.group(1)
                    violations.append({
                        "file": rel_path,
                        "line": i,
                        "rule": "Z-Index Token Rule",
                        "detail": f"하드코딩된 숫자 z-index({val})가 발견되었습니다. AI_IMPLEMENTATION_SPEC.md의 var(--z-*) 토큰을 사용하세요.",
                        "snippet": line.strip()
                    })

        # ── Rule 2: Focus+Context & Zero-JS Styling Rule (TSX/JSX) ──
        if ext in [".tsx", ".jsx"]:
            # (a) Selection-based or focus-based conditional opacity
            if re.search(r"\bopacity:\s*.*?(selected|active|focus|highlight).*?\?", code, re.IGNORECASE):
                violations.append({
                    "file": rel_path,
                    "line": i,
                    "rule": "Focus+Context Pure CSS Rule",
                    "detail": "노드/엣지 선택 상태에 따른 인라인 opacity 조작이 발견되었습니다. Focus+Context 딤 처리는 index.css의 .has-selection 클래스를 통해서만 제어해야 합니다.",
                    "snippet": line.strip()
                })

            # (b) Hardcoded dimming opacity literal (0.4)
            if re.search(r"\bopacity:\s*0?\.4\b", code):
                violations.append({
                    "file": rel_path,
                    "line": i,
                    "rule": "Focus+Context Pure CSS Rule",
                    "detail": "인라인 딤 opacity: 0.4가 발견되었습니다. 순수 CSS(.has-selection .react-flow__node:not(.active))로 제어하세요.",
                    "snippet": line.strip()
                })

            # (c) Conditional or inline boxShadow in node/edge components
            is_node_or_edge_component = "CoverageNode" in rel_path or "FloatingEdge" in rel_path
            if is_node_or_edge_component and re.search(r"\bboxShadow:\s*['\"`#\d]", code):
                violations.append({
                    "file": rel_path,
                    "line": i,
                    "rule": "Zero-JS Styling Rule",
                    "detail": "노드/엣지 컴포넌트 내 인라인 boxShadow가 발견되었습니다. CSS 클래스(.active, .highlight-*, .badge-selected)를 사용하세요.",
                    "snippet": line.strip()
                })
            elif re.search(r"\bboxShadow:\s*[^,\n]+\?", code):
                violations.append({
                    "file": rel_path,
                    "line": i,
                    "rule": "Zero-JS Styling Rule",
                    "detail": "조건부 인라인 boxShadow가 발견되었습니다. CSS 활성 클래스로 분기하세요.",
                    "snippet": line.strip()
                })

            # (d) Inline transform: scale in TSX
            if re.search(r"\btransform:\s*['\"`][^'\"`]*scale\(", code):
                violations.append({
                    "file": rel_path,
                    "line": i,
                    "rule": "Parent Scale Immutability Rule",
                    "detail": "TSX 인라인 스타일에 transform: scale이 사용되었습니다. box-shadow 포커스 링을 사용하세요.",
                    "snippet": line.strip()
                })

        # ── Rule 3: Port Standardization Rule ──
        # (a) Deprecated port 8001 banned everywhere in project code
        if "8001" in code:
            if not rel_path.endswith(".md") and "ORIGINAL_REQUEST" not in rel_path and "seed.py" not in rel_path:
                violations.append({
                    "file": rel_path,
                    "line": i,
                    "rule": "Port Standardization Rule",
                    "detail": "구버전 포트(8001)가 발견되었습니다. 표준 포트인 8190 또는 환경변수(PORT/BACKEND_PORT)를 사용하세요.",
                    "snippet": line.strip()
                })

        # (b) Hardcoded 8190 in connection/proxy targets without env var fallback
        if "8190" in code:
            if rel_path.endswith((".ts", ".js", ".py")) and not rel_path.endswith(".md"):
                # Check current and adjacent lines for env var fallback or exception handler
                context_lines = [lines[max(0, i-3)], lines[max(0, i-2)], lines[max(0, i-1)], line]
                combined_context = " ".join(context_lines)
                has_env_fallback = any(token in combined_context for token in ["getenv", "process.env", "BACKEND_PORT", "PORT", "env.", "except", "def "])
                # Exclude comment lines or docstrings
                if not has_env_fallback and not code.strip().startswith(("#", "//", "/*", "*", '"""', "'''")):
                    violations.append({
                        "file": rel_path,
                        "line": i,
                        "rule": "Port Standardization Rule",
                        "detail": "환경변수(PORT / BACKEND_PORT) 폴백 없이 하드코딩된 8190 포트가 발견되었습니다.",
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
    Rule 6 [Skip Reason Rule]: E2E 테스트의 test.skip / test.fixme 바로 윗줄에는
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
                            "file": os.path.relpath(path, WORKSPACE_ROOT).replace("\\", "/"),
                            "line": i + 1,
                            "rule": "Skip Reason Rule",
                            "detail": "test.skip/test.fixme 바로 윗줄에 '// SKIP-REASON: <사유>' 주석이 필요합니다.",
                            "snippet": line.strip()
                        })

# Rule 7 [i18n Centralization Rule]: UI 문자열은 frontend/src/locales/에서만 가져와야 합니다.
# (단일 한국어 로케일 정책. 주석 속 한글은 허용) 2026-10 전체 이관 완료 후 frontend/src 전체로 확대되었습니다.
LOCALES_DIR = os.path.join(FRONTEND_SRC, "locales")
HANGUL = re.compile(r"[가-힣]")

def _i18n_target_files():
    for root, dirs, files in os.walk(FRONTEND_SRC):
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]
        if os.path.abspath(root).startswith(os.path.abspath(LOCALES_DIR)):
            continue
        for f in files:
            if f.endswith((".ts", ".tsx")):
                yield os.path.relpath(os.path.join(root, f), WORKSPACE_ROOT).replace("\\", "/")

def check_i18n_migrated_files():
    for rel in _i18n_target_files():
        path = os.path.join(WORKSPACE_ROOT, rel)
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

    # Also scan root frontend config files
    vite_config_path = os.path.join(FRONTEND_DIR, "vite.config.ts")
    if os.path.exists(vite_config_path):
        check_file(vite_config_path)

    check_test_skip_reasons(os.path.join(WORKSPACE_ROOT, "e2e-tests", "tests"))
    check_i18n_migrated_files()

    if not violations:
        print("\n✅ [SUCCESS] All UI, Z-Index, and Port policies are strictly compliant!")
        print("   - Z-Index 12-Tier tokens verified.")
        print("   - Focus+Context Pure CSS & Zero-JS Styling verified.")
        print("   - Standard Port 8190 consistency verified.")
        print("   - Halo Handle Outer Rim & Stacking isolation verified.")
        print("   - Parent Scale Immutability verified.")
        print("   - E2E Test Skip Reasons verified.")
        print("   - i18n Centralization verified.\n")
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
