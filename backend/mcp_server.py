"""
BKAi MCP server — exposes the admissions tool registry over the Model Context Protocol.

    python mcp_server.py                        # stdio (Claude Desktop / Cursor / Claude Code)
    python mcp_server.py --http --port 8765     # streamable HTTP (remote clients, mcpo → OpenAPI)

The same functions power the in-process LangGraph agents, so MCP clients see exactly what BKAi sees.
"""

from __future__ import annotations

import argparse
import functools
import inspect
import os

os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

from mcp.server.mcpserver import MCPServer  # noqa: E402

from tools import admissions as T  # noqa: E402

server = MCPServer(
    name="bkai-admissions",
    title="BKAi — HCMUT admissions data",
    instructions=(
        "Official admissions data of Ho Chi Minh City University of Technology (HCMUT, VNU-HCM): cut-off scores "
        "2023–2026, 2026 quotas, subject combinations, tuition, English-certificate conversion, key dates, and a "
        "hybrid search over official admission documents. Use find_majors or list_majors to get major_ids "
        "(format '<program_id>:<code>', e.g. 'tieu_chuan:106') before calling score/quota tools."
    ),
)


def _public(fn):
    """Hide the internal `agent` parameter (used for tracing) from the MCP tool schema."""
    sig = inspect.signature(fn)

    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        return fn(*args, agent="mcp", **kwargs)

    wrapper.__signature__ = sig.replace(parameters=[p for n, p in sig.parameters.items() if n != "agent"])
    wrapper.__annotations__ = {k: v for k, v in fn.__annotations__.items() if k != "agent"}
    return wrapper


for fn in T.MCP_TOOLS:
    server.add_tool(_public(fn), name=fn.__name__, description=(fn.__doc__ or "").strip())


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--http", action="store_true")
    ap.add_argument("--port", type=int, default=8765)
    args = ap.parse_args()
    if args.http:
        server.run(transport="streamable-http", port=args.port)
    else:
        server.run()


if __name__ == "__main__":
    main()
