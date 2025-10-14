package com.ipn.mx.servicios.impl;

import com.ipn.mx.dominio.entidades.Tarea;
import com.ipn.mx.dominio.entidades.Usuario;
import com.ipn.mx.dominio.repositorios.TareaRepository;
import com.ipn.mx.dominio.repositorios.UsuarioRepository;
import com.ipn.mx.servicios.TareaService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class TareaServiceImpl implements TareaService {

    @Autowired
    private TareaRepository tareaRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Override
    @Transactional
    public Tarea save(Tarea tarea) {
        if (tarea.getOwner() != null && tarea.getOwner().getId() != null) {
            Optional<Usuario> optUser = usuarioRepository.findById(tarea.getOwner().getId());
            optUser.ifPresent(tarea::setOwner);
        }
        return tareaRepository.save(tarea);
    }

    @Override
    @Transactional(readOnly = true)
    public Tarea read(Long id) {
        return tareaRepository.findById(id).orElse(null);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Tarea> readAll() {
        return tareaRepository.findAll();
    }

    @Override
    @Transactional
    public void delete(Long id) {
        tareaRepository.deleteById(id);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Tarea> findByOwnerId(Long ownerId) {
        return tareaRepository.findByOwnerId(ownerId);
    }

    @Override
    @Transactional
    public Tarea setCompletada(Long id, boolean completada) {
        Optional<Tarea> opt = tareaRepository.findById(id);
        if (opt.isPresent()) {
            Tarea t = opt.get();
            t.setCompletada(completada);
            return tareaRepository.save(t);
        }
        return null;
    }
}