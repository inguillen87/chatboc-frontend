const { Server } = require("socket.io");

function initializeSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: "*", // En producción, debería ser el dominio del frontend
      methods: ["GET", "POST"]
    }
  });

  console.log("🔌 Socket.io server initialized");

  io.on("connection", (socket) => {
    console.log(`⚡️ User connected: ${socket.id}`);

    socket.on("join_ticket_room", (ticketId) => {
      socket.join(ticketId);
      console.log(`User ${socket.id} joined room for ticket ${ticketId}`);
    });

    socket.on("leave_ticket_room", (ticketId) => {
      socket.leave(ticketId);
      console.log(`User ${socket.id} left room for ticket ${ticketId}`);
    });

    socket.on("disconnect", () => {
      console.log(`🔥 User disconnected: ${socket.id}`);
    });
  });

  // --- SIMULACIÓN DE EVENTOS DEL BACKEND ---
  // En un entorno real, estas emisiones se harían desde la lógica de negocio
  // (ej. después de guardar un nuevo ticket en la base de datos).

  // Simular un nuevo ticket cada 30 segundos
  setInterval(() => {
    const newTicket = {
      id: Math.floor(Math.random() * 10000),
      tipo: 'municipio',
      nro_ticket: Math.floor(Math.random() * 100000),
      asunto: "Nuevo reclamo simulado",
      estado: "nuevo",
      fecha: new Date().toISOString(),
      nombre_usuario: "Usuario Simulado",
      detalles: "Este es un ticket generado automáticamente para pruebas.",
      priority: "medium",
      sla_status: "on_track",
    };
    io.emit("new_ticket", newTicket);
    console.log("Sent 'new_ticket' event with ticket:", newTicket.id);
  }, 30000);

  // Simular una actualización de comentario en un ticket existente cada 20 segundos
  setInterval(() => {
    const ticketIdToUpdate = 1; // ID de ticket de ejemplo
    const newComment = {
      id: Math.floor(Math.random() * 10000),
      comentario: "Este es un nuevo comentario simulado del usuario.",
      fecha: new Date().toISOString(),
      es_admin: false,
    };
    io.to(ticketIdToUpdate).emit("new_comment", { ticketId: ticketIdToUpdate, comment: newComment });
    console.log(`Sent 'new_comment' to room ${ticketIdToUpdate}`);
  }, 20000);


  return io;
}

module.exports = { initializeSocket };
