with open('frontend/src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("import React, { useEffect, useState, useCallback, useMemo } from 'react';", "import { useEffect, useState, useCallback, useMemo } from 'react';")
content = content.replace("const [hasSelection, setHasSelection] = useState(false);", "")
content = content.replace("setHasSelection(isSelected);", "")

with open('frontend/src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
