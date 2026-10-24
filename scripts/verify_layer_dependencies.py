import glob
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

# Layer hierarchy rank
# 1: types, locales
# 2: api, utils, floatingEdgeUtils, statusPropagation
# 3: hooks
# 4: components, CoverageNode, FloatingEdge, PresetManagerModal
# 5: App.tsx, main.tsx

def get_layer(rel_path):
    p = rel_path.replace('\\', '/')
    if p.startswith('frontend/src/'):
        p = p[len('frontend/src/'):]

    if p == 'App.tsx' or p == 'main.tsx':
        return 5, 'Coordinator (App/main)'
    if p.startswith('components/') or p in ['CoverageNode.tsx', 'FloatingEdge.tsx']:
        return 4, 'Components & View Cards'
    if p.startswith('hooks/'):
        return 3, 'Hooks'
    if p.startswith('api/') or p.startswith('utils/') or p in ['floatingEdgeUtils.ts', 'statusPropagation.ts', 'layout.ts']:
        return 2, 'API, Utilities & Layout calculation'
    if p.startswith('types/') or p.startswith('locales/'):
        return 1, 'Types & Locales'
    return 0, 'Other'

def resolve_import(source_file, import_str):
    if not import_str.startswith('.'):
        return None  # External package
    source_dir = os.path.dirname(source_file)
    target = os.path.normpath(os.path.join(source_dir, import_str)).replace('\\', '/')
    
    # Try extensions
    for ext in ['', '.ts', '.tsx', '/index.ts', '/index.tsx']:
        candidate = target + ext
        if os.path.isfile(candidate):
            return candidate
    return target

def main():
    ts_files = [f.replace('\\', '/') for f in glob.glob('frontend/src/**/*', recursive=True) if f.endswith(('.ts', '.tsx'))]
    print(f"Total files analyzed: {len(ts_files)}")

    adj = {f: [] for f in ts_files}
    layer_violations = []
    app_imports = []

    import_regex = re.compile(r'(?:import|from)\s+[\'"]([^\'"]+)[\'"]')

    for f in ts_files:
        src_layer_num, src_layer_name = get_layer(f)
        content = open(f, encoding='utf-8').read()
        imports = import_regex.findall(content)

        for imp in imports:
            resolved = resolve_import(f, imp)
            if not resolved or resolved not in adj:
                continue

            adj[f].append(resolved)

            # Check if importing App
            if 'App' in resolved and f != resolved and not f.endswith('main.tsx'):
                app_imports.append((f, resolved, imp))

            # Check layer ordering: A file in layer N should not import from layer M where M > N
            tgt_layer_num, tgt_layer_name = get_layer(resolved)
            if src_layer_num < tgt_layer_num:
                layer_violations.append({
                    'source': f,
                    'source_layer': f"L{src_layer_num} ({src_layer_name})",
                    'target': resolved,
                    'target_layer': f"L{tgt_layer_num} ({tgt_layer_name})",
                    'import_spec': imp
                })

    print(f"\n1. Direct App imports into lower layers: {len(app_imports)}")
    for src, tgt, imp in app_imports:
        print(f"   [VIOLATION] {src} imports {tgt} via '{imp}'")

    print(f"\n2. Backward layer imports (Lower Layer -> Higher Layer): {len(layer_violations)}")
    for v in layer_violations:
        print(f"   [VIOLATION] {v['source']} [{v['source_layer']}] imports {v['target']} [{v['target_layer']}] via '{v['import_spec']}'")

    # Cycle detection using Tarjan / DFS
    visited = {}
    recursion_stack = []
    cycles = []

    def dfs(node):
        visited[node] = True
        recursion_stack.append(node)

        for neighbor in adj.get(node, []):
            if neighbor not in visited:
                dfs(neighbor)
            elif neighbor in recursion_stack:
                cycle_start = recursion_stack.index(neighbor)
                cycle = recursion_stack[cycle_start:] + [neighbor]
                cycles.append(cycle)

        recursion_stack.pop()

    for f in ts_files:
        if f not in visited:
            dfs(f)

    print(f"\n3. Circular import cycles detected: {len(cycles)}")
    for idx, c in enumerate(cycles, 1):
        print(f"   Cycle #{idx}:")
        for node in c:
            print(f"     -> {node}")

    if not app_imports and not layer_violations and not cycles:
        print("\n✅ [SUCCESS] Acyclic Layer Invariants are 100% compliant!")
        return 0
    else:
        print(f"\n❌ [FAILURE] Invariants broken: {len(app_imports)} App imports, {len(layer_violations)} layer violations, {len(cycles)} cycles.")
        return 1

if __name__ == '__main__':
    sys.exit(main())
