import os, io, time, random
import pandas as pd
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from mlxtend.frequent_patterns import apriori, fpgrowth, association_rules

app = FastAPI(title="Online Retail Market Basket API", version="1.0.0")
origins = [x.strip() for x in os.getenv("FRONTEND_ORIGIN", "*").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False, allow_methods=["*"], allow_headers=["*"])
CACHE = {}

def demo_data(n=900, seed=42):
    rng=random.Random(seed)
    groups=[["Pasta","Tomato Sauce","Olive Oil","Parmesan"],["Coffee","Milk","Sugar","Biscuits"],["Bread","Butter","Jam","Eggs"],["Chips","Salsa","Soft Drink","Popcorn"],["Shampoo","Conditioner","Soap","Toothpaste"]]
    products=sorted({p for g in groups for p in g}|{"Rice","Tea","Apples","Bananas","Yogurt"})
    rows=[]
    for order in range(1,n+1):
        chosen=set()
        for group in groups:
            if rng.random()<.28: chosen.update(p for p in group if rng.random()<.72)
        for p in products:
            if rng.random()<.025: chosen.add(p)
        for p in chosen: rows.append({"InvoiceNo":f"DEMO{order:05d}","Description":p,"Quantity":rng.randint(1,3)})
    return pd.DataFrame(rows)

def clean_and_basket(df):
    df=df.copy()
    df.columns=[str(c).strip() for c in df.columns]
    aliases={"Invoice":"InvoiceNo","Invoice Number":"InvoiceNo","Invoice Number ":"InvoiceNo","OrderID":"InvoiceNo","TransactionID":"InvoiceNo","Item":"Description","Product":"Description","Stock Code":"StockCode","qty":"Quantity"}
    df=df.rename(columns={c:aliases.get(c,c) for c in df.columns})
    invoice=next((c for c in ["InvoiceNo","Invoice","Order"] if c in df.columns),None)
    product=next((c for c in ["Description","Product","StockCode","Item"] if c in df.columns),None)
    if not invoice or not product: raise ValueError("CSV needs order ID and product columns, such as InvoiceNo and Description.")
    df=df.rename(columns={invoice:"InvoiceNo",product:"Description"})
    if "Quantity" not in df: df["Quantity"]=1
    df["Quantity"]=pd.to_numeric(df["Quantity"],errors="coerce")
    df=df.dropna(subset=["InvoiceNo","Description","Quantity"])
    df["Description"]=df["Description"].astype(str).str.strip()
    df=df[(df.Description!="")&(df.Quantity>0)]
    df=df[~df.InvoiceNo.astype(str).str.upper().str.startswith("C")]
    df=df.drop_duplicates(["InvoiceNo","Description"])
    if df.empty: raise ValueError("No valid transaction lines remain after cleaning.")
    basket=df.pivot_table(index="InvoiceNo",columns="Description",values="Quantity",aggfunc="sum",fill_value=0).gt(0)
    if len(basket)<2 or basket.shape[1]<2: raise ValueError("Need at least two transactions and two products.")
    return df,basket

def mine(basket, method, support, confidence, min_lift):
    start=time.perf_counter()
    sets=apriori(basket,min_support=support,use_colnames=True,low_memory=True) if method=="apriori" else fpgrowth(basket,min_support=support,use_colnames=True)
    elapsed=time.perf_counter()-start
    if sets.empty or sets.itemsets.map(len).max()<2: return [],len(sets),elapsed
    rules=association_rules(sets,metric="confidence",min_threshold=confidence)
    rules=rules[rules.lift>=min_lift].sort_values(["lift","confidence"],ascending=False)
    output=[]
    for _,r in rules.head(500).iterrows():
        output.append({"antecedents":sorted(list(r.antecedents)),"consequents":sorted(list(r.consequents)),"support":float(r.support),"confidence":float(r.confidence),"lift":float(r.lift)})
    return output,len(sets),elapsed

@app.get("/")
def root(): return {"message":"Market Basket Analysis API is running"}
@app.get("/health")
def health(): return {"status":"ok"}

@app.post("/api/analyze")
async def analyze(file: UploadFile|None=File(default=None), min_support:float=Form(.02), min_confidence:float=Form(.2), min_lift:float=Form(1.2)):
    try:
        if not (0.0001<=min_support<=1 and 0<=min_confidence<=1 and min_lift>=0): raise ValueError("Invalid mining thresholds.")
        if file:
            raw=pd.read_csv(io.BytesIO(await file.read()),encoding_errors="replace")
            label=file.filename or "Uploaded CSV"; is_demo=False
        else:
            raw=demo_data(); label="Built-in synthetic demonstration data"; is_demo=True
        clean,basket=clean_and_basket(raw)
        ar,ai,at=mine(basket,"apriori",min_support,min_confidence,min_lift)
        fr,fi,ft=mine(basket,"fpgrowth",min_support,min_confidence,min_lift)
        CACHE.clear()
        CACHE["apriori"]=ar; CACHE["fpgrowth"]=fr
        top=clean.Description.value_counts().head(12)
        return {"dataset_label":label,"is_demo":is_demo,"transaction_count":int(len(basket)),"product_count":int(basket.shape[1]),
          "fp_itemset_count":fi,"fp_rule_count":len(fr),"products":sorted(basket.columns.tolist()),
          "top_products":[{"product":str(k),"line_items":int(v)} for k,v in top.items()],
          "comparison":[{"algorithm":"Apriori","runtime_seconds":at,"itemsets":ai,"rules":len(ar)},
                        {"algorithm":"FP-Growth","runtime_seconds":ft,"itemsets":fi,"rules":len(fr)}],
          "apriori_rules":ar,"fpgrowth_rules":fr}
    except Exception as e:
        raise HTTPException(status_code=400,detail=str(e))

class RecommendationRequest(BaseModel):
    products:list[str]
    algorithm:str="fpgrowth"
    top_k:int=5

@app.post("/api/recommend")
def recommend(req:RecommendationRequest):
    if req.algorithm not in CACHE: raise HTTPException(400,"Run analysis first.")
    scores={}
    cart=set(req.products)
    for rule in CACHE[req.algorithm]:
        if set(rule["antecedents"]).issubset(cart):
            for p in set(rule["consequents"])-cart:
                value=(rule["confidence"],rule["lift"])
                if p not in scores or value[1]>scores[p][1]: scores[p]=value
    ranked=sorted(scores.items(),key=lambda x:(x[1][1],x[1][0]),reverse=True)[:max(1,min(req.top_k,20))]
    return {"recommendations":[{"product":p,"confidence":v[0],"lift":v[1]} for p,v in ranked]}
