import sys
import os
import time

# Add the current directory to sys.path
sys.path.append(os.path.abspath("."))

from backend.app.agents import get_orchestrator

def run_full_diagnostic():
    print("--- AURACORE ELITE FULL SYSTEM DIAGNOSTIC ---")
    
    test_cases = [
        {"name": "GENERAL_MISSION", "goal": "What is the capital of France?", "spec": "General"},
        {"name": "EXPERT_ANALYST", "goal": "Summarize the latest trends in AI agents.", "spec": "Analyst"},
    ]
    
    for case in test_cases:
        print(f"\n[TEST] {case['name']} | Goal: {case['goal']}")
        try:
            agent = get_orchestrator(case['goal'], case['spec'])
            gen = agent.kickoff()
            
            print("  - Ignition Sequence Started...")
            start_time = time.time()
            chunks_received = 0
            
            # Pull first 3 chunks to see the flow
            for _ in range(3):
                chunk = next(gen)
                print(f"  - [{chunks_received}] Status: {chunk.get('message', 'N/A')}")
                chunks_received += 1
                
            print(f"  - SUCCESS: {case['name']} is active and flowing.")
            
        except Exception as e:
            print(f"  - FAILURE in {case['name']}: {e}")
            import traceback
            traceback.print_exc()

    print("\n--- DIAGNOSTIC COMPLETE ---")

if __name__ == "__main__":
    run_full_diagnostic()
