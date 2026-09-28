# CoverageMap

CoverageMap은 기존의 선형적인 스프레드시트 기반 QA 방식을 대체하여, 모바일 게임 QA 프로세스의 비선형적인 구조를 상호작용 가능한 그래프 기반의 테스트 커버리지 도구로 시각화하는 Living Document Platform입니다.

## 실행 방법 (Running the Project)

### 1. 데이터베이스 실행 (Neo4j)
프로젝트 루트의 `run_db.bat`을 실행하세요. 시스템 환경변수(`NEO4J_HOME`), PATH, 또는 C/D/E 드라이브의 설치 폴더를 자동으로 감지하여 실행됩니다.
(Docker 환경을 선호하는 경우 `docker compose up -d neo4j` 명령어로도 즉시 실행할 수 있습니다.)

### 2. 백엔드 실행 (Python/FastAPI)
프론트엔드와의 포트 충돌 및 통신을 위해 반드시 `8190` 포트로 실행해야 합니다. 프로젝트 루트에 있는 `run_backend.bat` 파일을 실행하거나 다음 명령어를 입력하세요:
```powershell
cd backend
uv run uvicorn main:app --reload --port 8190
```

### 3. 프론트엔드 실행 (React/Vite)
```powershell
cd frontend
npm run dev
```
