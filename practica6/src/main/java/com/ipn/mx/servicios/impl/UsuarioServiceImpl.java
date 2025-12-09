package com.ipn.mx.servicios.impl;

import com.ipn.mx.dominio.entidades.Usuario;
import com.ipn.mx.dominio.repositorios.UsuarioRepository;
import com.ipn.mx.servicios.UsuarioService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class UsuarioServiceImpl implements UsuarioService {

    private final UsuarioRepository usuarioRepository;

    // Constructor injection (mejor para tests y claridad)
    public UsuarioServiceImpl(UsuarioRepository usuarioRepository) {
        this.usuarioRepository = usuarioRepository;
    }

    @Override
    @Transactional
    public Usuario save(Usuario usuario) {
        // guarda o actualiza el usuario tal cual (sin lógica adicional)
        return usuarioRepository.save(usuario);
    }

    @Override
    @Transactional(readOnly = true)
    public Usuario read(Long id) {
        if (id == null) return null;
        return usuarioRepository.findById(id).orElse(null);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Usuario> readAll() {
        return usuarioRepository.findAll();
    }

    @Override
    @Transactional
    public void delete(Long id) {
        if (id == null) return;
        usuarioRepository.deleteById(id);
    }

    @Override
    @Transactional(readOnly = true)
    public Usuario findByUsername(String username) {
        if (username == null || username.isBlank()) return null;
        Optional<Usuario> opt = usuarioRepository.findByUsername(username);
        return opt.orElse(null);
    }
}