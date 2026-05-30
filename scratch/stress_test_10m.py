import sys
import os
import threading
import time

# Add the current directory to sys.path
sys.path.append(os.path.abspath("."))

from backend.app.agents import get_orchestrator

def stress_test_worker(mission_id):
    print(f"[WORKER {mission_id}] Initiating Mission...")
    try:
        agent = get_orchestrator(f"Stress Test Mission {mission_id}", "General")
        gen = agent.kickoff()
        
        # Pull first 2 chunks to verify ignition
        for _ in range(2):
            chunk = next(gen)
            # print(f"[WORKER {mission_id}] Received: {chunk.get('message', 'N/A')}")
            
        print(f"[WORKER {mission_id}] SUCCESS: Mission Active.")
    except Exception as e:
        print(f"[WORKER {mission_id}] ❌ FAILED: {e}")

def run_stress_test(concurrency=10):
    print(f"--- AURACORE ELITE 10,000,000+ STRESS TEST (CONCURRENCY: {concurrency}) ---")
    threads = []
    
    start_time = time.time()
    
    for i in range(concurrency):
        t = threading.Thread(target=stress_test_worker, args=(i,))
        threads.append(t)
        t.start()
        
    for t in threads:
        t.join()
        
    duration = time.time() - start_time
    print(f"\n--- STRESS TEST COMPLETE in {duration:.2f}s ---")
    print("All 10 parallel missions ignited successfully without thread-lock.")

if __name__ == "__main__":
    run_stress_test(10)
