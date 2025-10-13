package com.ipn.mx.servicios;

import com.ipn.mx.dominio.entidades.Usuario;

import java.util.List;

public interface UsuarioService {
    Usuario save(Usuario usuario);
    Usuario read(Long id);
    List<Usuario> readAll();
    void delete(Long id);
    Usuario findByUsername(String username);
}