async def test_login_com_credenciais_corretas_retorna_token(client, usuario):
    response = await client.post(
        "/api/operacao/login", json={"username": usuario.username, "senha": "senha123"}
    )
    assert response.status_code == 200
    body = response.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


async def test_login_com_senha_errada_retorna_401(client, usuario):
    response = await client.post(
        "/api/operacao/login", json={"username": usuario.username, "senha": "errada"}
    )
    assert response.status_code == 401
    assert response.json()["erro"] == "credenciais_invalidas"


async def test_login_com_usuario_inexistente_retorna_401(client):
    response = await client.post(
        "/api/operacao/login", json={"username": "ninguem", "senha": "x"}
    )
    assert response.status_code == 401


async def test_login_retorna_nome_do_estabelecimento(client, usuario):
    response = await client.post(
        "/api/operacao/login", json={"username": usuario.username, "senha": "senha123"}
    )
    assert response.status_code == 200
    assert response.json()["nome_estabelecimento"] == "Restaurante Teste"
