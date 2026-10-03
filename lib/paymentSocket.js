const paymentSocket = (io) => {
  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("join-order", (orderId) => {
      socket.join(`order_${orderId}`);

      console.log(
        `${socket.id} joined order_${orderId}`
      );
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
    });
  });
};

export default paymentSocket;