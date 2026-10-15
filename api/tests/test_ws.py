import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.main import app


def test_ws_mesa_token_invalido_fecha_com_1008():
    client = TestClient(app)
    with pytest.raises(WebSocketDisconnect) as excinfo:
        with client.websocket_connect("/ws/m/token-inexistente"):
            pass
    assert excinfo.value.code == 1008


def test_ws_mesa_valida_recebe_estado_inicial(mesa_aberta):
    client = TestClient(app)
    with client.websocket_connect(f"/ws/m/{mesa_aberta.token}") as ws:
        mensagem = ws.receive_json()
        assert mensagem["tipo"] == "estado.inicial"
        assert mensagem["dados"]["numero"] == mesa_aberta.numero
        assert mensagem["dados"]["status"] == "aberta"


def test_ws_mesa_responde_ping_com_pong(mesa_aberta):
    client = TestClient(app)
    with client.websocket_connect(f"/ws/m/{mesa_aberta.token}") as ws:
        ws.receive_json()  # estado.inicial
        ws.send_json({"tipo": "ping"})
        resposta = ws.receive_json()
        assert resposta == {"tipo": "pong"}


def test_ws_operacao_token_invalido_fecha_com_1008():
    client = TestClient(app)
    with pytest.raises(WebSocketDisconnect) as excinfo:
        with client.websocket_connect("/ws/operacao?token=invalido"):
            pass
    assert excinfo.value.code == 1008


def test_ws_operacao_token_valido_recebe_estado_inicial(token_operacao, mesa_aberta):
    client = TestClient(app)
    with client.websocket_connect(f"/ws/operacao?token={token_operacao}") as ws:
        mensagem = ws.receive_json()
        assert mensagem["tipo"] == "estado.inicial"
        assert "mesas" in mensagem["dados"]
        assert "solicitacoes" in mensagem["dados"]
        assert any(m["id"] == mesa_aberta.id for m in mensagem["dados"]["mesas"])
