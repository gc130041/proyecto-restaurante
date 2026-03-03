import Order from "./order.model.js";
import Table from "../tables/table.model.js";

const VALID_TRANSITIONS = {
    "EN_ESPERA": ["EN_COCINA"],
    "EN_COCINA": ["LISTO"],
    "LISTO": ["SERVIDO"],
    "SERVIDO": []
};

export const getOrders = async (req, res) => {
    try {
        const { isActive } = req.query;

        const filter = {};
        if (isActive !== undefined) {
            filter.isActive = isActive === 'true';
        }

        const orders = await Order.find(filter)
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            total: orders.length,
            data: orders
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al obtener las órdenes',
            error: error.message
        });
    }
};

export const getOrderById = async (req, res) => {
    try {
        const { id } = req.params;
        const order = await Order.findById(id);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Orden no encontrada'
            });
        }
        res.status(200).json({
            success: true,
            data: order
        });
    } catch (error) {
        res.status(500).json({
            success: false, 
            message: 'Error al obtener la orden',
            error: error.message
        });
    }
};

export const getOrdersByTable = async (req, res) => {
    try {
        const { tableId } = req.params;
        const orders = await Order.find({ table: tableId }).sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            total: orders.length,
            data: orders
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al obtener las órdenes por mesa',
            error: error.message
        });
    }
};

export const createOrder = async (req, res) => {
    try {
        const { table, restaurant, items } = req.body;
        const waiter = req.user._id; 

        const tableUpdate = await Table.findOneAndUpdate(
            { _id: table, status: "Disponible" }, 
            { $set: { status: "Ocupada" } },
            { new: true }
        );

        if (!tableUpdate) {
            return res.status(400).json({
                success: false,
                message: "Mesa no disponible o ya ocupada."
            });
        }

        const newOrder = new Order({ table, waiter, restaurant, items });
        await newOrder.save();

        res.status(201).json({ success: true, order: newOrder });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const updateItemStatus = async (req, res) => {
    try {
        const { orderId, itemId } = req.params;
        const { status: nextStatus } = req.body;

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ success: false, message: "Orden no encontrada" });

        const item = order.items.id(itemId);
        if (!item) return res.status(404).json({ success: false, message: "Ítem no encontrado" });

        if (!VALID_TRANSITIONS[item.status]?.includes(nextStatus)) {
            return res.status(400).json({
                success: false, 
                message: `No se puede pasar de ${item.status} a ${nextStatus}`
            });
        }

        item.status = nextStatus;
        await order.save();

        res.status(200).json({ success: true, order });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const order = await Order.findByIdAndUpdate(id, { status }, { new: true });
        if (!order) return res.status(404).json({ success: false, message: "Orden no encontrada" });

        if (status === "CERRADA" || status === "CANCELADA") {
            await Table.findByIdAndUpdate(order.table, { $set: { status: "Disponible" } });
        }

        res.status(200).json({ success: true, message: "Estado actualizado y mesa sincronizada" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};