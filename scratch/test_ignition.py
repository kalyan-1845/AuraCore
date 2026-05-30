import sys
import os

# Add the current directory to sys.path
sys.path.append(os.path.abspath("."))

from backend.app.agents import get_orchestrator

def test_agent():
    print("Testing Agent Ignition...")
    try:
        agent = get_orchestrator("Test Goal", "General")
        print("Agent created. Starting kickoff...")
        gen = agent.kickoff()
        print("Generator created. Pulling first chunk...")
        first_chunk = next(gen)
        print(f"SUCCESS! First chunk received: {first_chunk}")
    except Exception as e:
        print(f"FAILURE: {e}")

if __name__ == "__main__":
    test_agent()
