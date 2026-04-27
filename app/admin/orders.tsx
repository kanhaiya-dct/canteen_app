import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { db } from '../../db/drizzle';
import { orders, orderItems, menuItems } from '../../db/schema';
import { eq, desc } from 'drizzle-orm';
import { ArrowLeft, Clock, UtensilsCrossed, Package, CheckCircle, ChevronRight, User, Phone, MapPin, Download } from 'lucide-react-native';
import { format } from 'date-fns';
import { generateProfessionalBill } from '../../utils/billGenerator';

export default function AdminOrdersScreen() {
  const router = useRouter();
  const [orderList, setOrderList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchOrders = async () => {
    try {
      const results = await db.select().from(orders).orderBy(desc(orders.createdAt));
      setOrderList(results);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchOrders();
      const interval = setInterval(fetchOrders, 10000);
      return () => clearInterval(interval);
    }, [])
  );

  const updateStatus = async (orderId: number, newStatus: string) => {
    try {
      await db.update(orders)
        .set({ status: newStatus })
        .where(eq(orders.id, orderId));
      fetchOrders();
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const viewOrderDetails = async (order: any) => {
    try {
      const items = await db.select({
        name: menuItems.name,
        quantity: orderItems.quantity,
        price: orderItems.priceAtTime
      })
      .from(orderItems)
      .innerJoin(menuItems, eq(orderItems.itemId, menuItems.id))
      .where(eq(orderItems.orderId, order.id));

      setSelectedOrder({ ...order, items });
      setIsDetailModalVisible(true);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Could not fetch order items');
    }
  };

  const downloadBill = async () => {
    if (isGenerating) return;
    if (selectedOrder && selectedOrder.items) {
      setIsGenerating(true);
      try {
        await generateProfessionalBill(selectedOrder, selectedOrder.items);
      } catch (error) {
        console.error(error);
      } finally {
        setIsGenerating(false);
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#FF9800';
      case 'preparing': return '#2196F3';
      case 'ready': return '#4CAF50';
      case 'delivered': return '#9E9E9E';
      default: return '#333';
    }
  };

  const renderOrderCard = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.orderCard} 
      onPress={() => viewOrderDetails(item)}
    >
      <View style={[styles.statusStrip, { backgroundColor: getStatusColor(item.status) }]} />
      <View style={styles.cardInfo}>
        <View style={styles.cardHeader}>
          <Text style={styles.orderId}>Order #${item.id}</Text>
          <Text style={styles.orderTime}>{format(new Date(item.createdAt), 'hh:mm a')}</Text>
        </View>
        <Text style={styles.studentName}>{item.studentName}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.studentClass}>{item.studentClass}</Text>
          <Text style={styles.orderTotal}>₹{item.totalPrice}</Text>
        </View>
      </View>
      <ChevronRight size={20} color="#CCC" {...({} as any)} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#333" {...({} as any)} />
        </TouchableOpacity>
        <Text style={styles.title}>Customer Orders</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FF9800" />
        </View>
      ) : (
        <FlatList
          data={orderList}
          renderItem={renderOrderCard}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No orders received yet</Text>
            </View>
          }
        />
      )}

      {/* Detail Modal */}
      <Modal visible={isDetailModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Order Details</Text>
              <TouchableOpacity onPress={() => setIsDetailModalVisible(false)}>
                <CheckCircle size={24} color="#333" {...({} as any)} />
              </TouchableOpacity>
            </View>

            {selectedOrder && (
              <ScrollView>
                <View style={styles.topActions}>
                  <TouchableOpacity style={styles.printBtn} onPress={downloadBill}>
                    <Download size={20} color="#FF9800" {...({} as any)} />
                    <Text style={styles.printBtnText}>Download Bill</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.infoSection}>
                  <View style={styles.infoRow}>
                    <User size={18} color="#666" {...({} as any)} />
                    <Text style={styles.infoText}>{selectedOrder.studentName}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <MapPin size={18} color="#666" {...({} as any)} />
                    <Text style={styles.infoText}>Class: {selectedOrder.studentClass}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Phone size={18} color="#666" {...({} as any)} />
                    <Text style={styles.infoText}>{selectedOrder.studentMobile}</Text>
                  </View>
                </View>

                <View style={styles.itemsSection}>
                  <Text style={styles.sectionTitle}>Ordered Items</Text>
                  {selectedOrder.items?.map((item: any, idx: number) => (
                    <View key={idx} style={styles.itemRow}>
                      <Text style={styles.itemMain}>{item.name} x {item.quantity}</Text>
                      <Text style={styles.itemSub}>₹{item.price * item.quantity}</Text>
                    </View>
                  ))}
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total Amount</Text>
                    <Text style={styles.totalValue}>₹{selectedOrder.totalPrice}</Text>
                  </View>
                </View>

                <View style={styles.statusSection}>
                  <Text style={styles.sectionTitle}>Manage Status</Text>
                  <View style={styles.statusButtons}>
                    <TouchableOpacity 
                      style={[styles.statusBtn, selectedOrder.status === 'preparing' && styles.activeStatus]}
                      onPress={() => updateStatus(selectedOrder.id, 'preparing')}
                    >
                      <UtensilsCrossed size={20} color={selectedOrder.status === 'preparing' ? '#fff' : '#2196F3'} {...({} as any)} />
                      <Text style={[styles.statusBtnText, selectedOrder.status === 'preparing' && styles.activeStatusText]}>Preparing</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.statusBtn, selectedOrder.status === 'ready' && styles.activeStatusReady]}
                      onPress={() => updateStatus(selectedOrder.id, 'ready')}
                    >
                      <Package size={20} color={selectedOrder.status === 'ready' ? '#fff' : '#4CAF50'} {...({} as any)} />
                      <Text style={[styles.statusBtnText, selectedOrder.status === 'ready' && styles.activeStatusText]}>Ready</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.statusBtn, selectedOrder.status === 'delivered' && styles.activeStatusDone]}
                      onPress={() => updateStatus(selectedOrder.id, 'delivered')}
                    >
                      <CheckCircle size={20} color={selectedOrder.status === 'delivered' ? '#fff' : '#9E9E9E'} {...({} as any)} />
                      <Text style={[styles.statusBtnText, selectedOrder.status === 'delivered' && styles.activeStatusText]}>Delivered</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 20, paddingTop: 60, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  backBtn: { padding: 8, marginRight: 10 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  list: { padding: 16 },
  orderCard: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center', paddingRight: 15, overflow: 'hidden', elevation: 3 },
  statusStrip: { width: 6, height: '100%' },
  cardInfo: { flex: 1, padding: 15 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  orderId: { fontSize: 12, color: '#999', fontWeight: '600' },
  orderTime: { fontSize: 12, color: '#999' },
  studentName: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  studentClass: { fontSize: 14, color: '#666' },
  orderTotal: { fontSize: 14, fontWeight: 'bold', color: '#FF9800' },
  empty: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#999', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '80%', padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  topActions: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 15 },
  printBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3E0', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  printBtnText: { color: '#FF9800', fontWeight: 'bold', marginLeft: 6, fontSize: 14 },
  infoSection: { backgroundColor: '#F5F5F5', padding: 15, borderRadius: 12, marginBottom: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  infoText: { marginLeft: 10, fontSize: 16, color: '#444' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  itemsSection: { marginBottom: 20 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  itemMain: { fontSize: 16, color: '#333' },
  itemSub: { fontSize: 16, fontWeight: '600', color: '#333' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, paddingTop: 10, borderTopWidth: 2, borderTopColor: '#EEE' },
  totalLabel: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  totalValue: { fontSize: 18, fontWeight: 'bold', color: '#FF9800' },
  statusSection: { marginBottom: 30 },
  statusButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  statusBtn: { flex: 1, alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#EEE', marginHorizontal: 4 },
  statusBtnText: { fontSize: 10, fontWeight: 'bold', marginTop: 6, color: '#666' },
  activeStatus: { backgroundColor: '#2196F3', borderColor: '#2196F3' },
  activeStatusReady: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  activeStatusDone: { backgroundColor: '#9E9E9E', borderColor: '#9E9E9E' },
  activeStatusText: { color: '#fff' },
});
