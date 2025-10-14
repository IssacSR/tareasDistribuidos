package com.ipn.mx.infraestructura;

import com.ipn.mx.dominio.entidades.Tarea;
import com.ipn.mx.servicios.TareaService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@CrossOrigin(origins = {"*"})
@RestController
@RequestMapping("/apiTarea")
public class TareaController {

    @Autowired
    private TareaService service;

    @GetMapping("/tareas")
    @ResponseStatus(HttpStatus.OK)
    public List<Tarea> readAll() {
        return service.readAll();
    }

    @GetMapping("/tareas/{id}")
    @ResponseStatus(HttpStatus.OK)
    public Tarea read(@PathVariable Long id) {
        Tarea t = service.read(id);
        if (t == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Tarea no encontrada");
        }
        return t;
    }

    @GetMapping("/tareas/owner/{ownerId}")
    @ResponseStatus(HttpStatus.OK)
    public List<Tarea> findByOwner(@PathVariable Long ownerId) {
        return service.findByOwnerId(ownerId);
    }

    @PostMapping("/tareas")
    @ResponseStatus(HttpStatus.CREATED)
    public Tarea create(@RequestBody Tarea tarea) {
        return service.save(tarea);
    }

    @PutMapping("/tareas/{id}")
    @ResponseStatus(HttpStatus.CREATED)
    public Tarea update(@RequestBody Tarea tarea, @PathVariable Long id) {
        Tarea t = service.read(id);
        if (t == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Tarea no encontrada");
        }

        t.setTitulo(tarea.getTitulo());
        t.setCompletada(tarea.getCompletada());
        t.setOwner(tarea.getOwner());

        return service.save(t);
    }

    @PutMapping("/tareas/{id}/completada")
    @ResponseStatus(HttpStatus.OK)
    public Tarea setCompletada(@PathVariable Long id, @RequestBody Map<String, Boolean> body) {
        Boolean completada = body.get("completada");
        if (completada == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Falta campo 'completada' en el body");
        }
        Tarea t = service.setCompletada(id, completada);
        if (t == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Tarea no encontrada");
        }
        return t;
    }

    @DeleteMapping("/tareas/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}