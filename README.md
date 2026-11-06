# Online Retail Market Basket Analysis — Vercel Edition

React + Vite frontend for Vercel and FastAPI + Python backend for Render. Includes Apriori, FP-Growth, association rules, algorithm timing comparison, CSV upload, and cross-sell recommendations.

## 1. Deploy backend to Render
1. Push this entire project to a GitHub repository.
2. In Render, create a **New Web Service** and connect the repository.
3. Set **Root Directory** to `backend`.
4. Build command: `pip install -r requirements.txt`
5. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Add environment variable `FRONTEND_ORIGIN` with your future Vercel URL, e.g. `https://your-project.vercel.app`.
7. Deploy and test `https://YOUR-API.onrender.com/health`.

## 2. Deploy frontend to Vercel
1. Import the same GitHub repository into Vercel.
2. Set **Root Directory** to `frontend`.
3. Framework preset: Vite. 
4. Add environment variable `VITE_API_URL` = your Render service URL, e.g. `https://market-basket-api.onrender.com` (no trailing slash).
5. Deploy.
6. Copy the Vercel URL and update Render's `FRONTEND_ORIGIN` to that exact URL. Redeploy the backend if needed.

## 3. Run locally (Windows PowerShell)
Backend terminal:
```powershell
cd backend
py -m venv .venv 
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload
```
Frontend terminal:
```powershell
cd frontend
npm install
npm run dev
```
Open the Vite URL shown in the terminal (usually http://localhost:5173). Set `VITE_API_URL=http://localhost:8000` in `frontend/.env.local` if needed.

## Dataset
The app accepts CSV order-line data with order/invoice ID, product description or product code, and quantity. The built-in data is synthetic for smoke testing only. For research, download UCI Online Retail and export its worksheet to CSV.

## Notes and limitations
- Backend currently keeps the most recent mined rules in process memory for recommendation requests. On Render, a restart clears that cache; run analysis again after restart. Multiple simultaneous users should be upgraded to persistent per-session storage.
- Large retail files can take time to mine. Use a subset for initial deployment and tune support thresholds.
- The runtime comparison is measured in the current backend environment, not a universal algorithm ranking.
- This is a starter implementation. Validate outputs, add tests, and document your dataset cleaning choices before academic submission.
- Do not load untrusted pickle files; this project does not need PKL files.
