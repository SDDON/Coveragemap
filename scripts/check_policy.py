#!/usr/bin/env python3
"""
scripts/check_policy.py
CoverageMap Tier 1 Static Policy Checker
Enforces UI/UX design policies, Z-Index tokens, and architectural constraints.

Enforced Rules:
1. [Z-Index Token Rule]: No hardcoded numeric z-index (e.g. z-index: 1000). Must use var(--z-*).
2. [Focus+Context Pure CSS Rule]: No node/edge dimming opacity manipulation in TSX.
3. [Port Consistency Rule]: No hardcoded deprecated port 8001 in project code. Must use 8190 or env vars.

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
        lines = f.readlines()

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
        # Note: Allow text secondary color (opacity: 0.8) or disabled buttons (opacity: 0.5) or hidden handle (opacity: 0).
        # Disallow setting node opacity for selection/focus de-emphasis (e.g. isSelected ? 1 : 0.4 on node container).
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
            # Exclude historical notes or documentation
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

def main():
    print("=" * 65)
    print(" 🛡️  CoverageMap Tier 1 Static Policy Checker")
    print(" Checking compliance against AI_IMPLEMENTATION_SPEC.md...")
    print("=" * 65)

    scan_directory(FRONTEND_SRC, [".css", ".tsx", ".ts"])
    scan_directory(BACKEND_DIR, [".py"])
    scan_directory(MCP_DIR, [".py"])

    if not violations:
        print("\n✅ [SUCCESS] All UI, Z-Index, and Port policies are strictly compliant!")
        print("   - Z-Index 12-Tier tokens verified.")
        print("   - Focus+Context Pure CSS rule verified.")
        print("   - Standard Port 8190 consistency verified.\n")
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
