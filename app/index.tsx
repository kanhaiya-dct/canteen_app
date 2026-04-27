import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  Image, 
  TouchableOpacity, 
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { db } from '../db/drizzle';
import { menuItems, menuSchedule, orders, orderItems } from '../db/schema';
import { eq, inArray } from 'drizzle-orm';
import { LogIn, UtensilsCrossed, ShoppingCart, Plus, Minus, X, CheckCircle, Clock, Package, Download, ChevronRight } from 'lucide-react-native';
import { format } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateProfessionalBill } from '../utils/billGenerator';

export default function HomeScreen() {
  const router = useRouter();
  const [menu, setMenu] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Cart State
  const [cart, setCart] = useState<{[key: number]: number}>({});
  const [isCheckoutModalVisible, setIsCheckoutModalVisible] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [studentMobile, setStudentMobile] = useState('');
  
  // Active Orders State
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isOrderModalVisible, setIsOrderModalVisible] = useState(false);
  const [isGeneratingBill, setIsGeneratingBill] = useState(false);

  const fetchTodayMenu = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const result = await db.select({
        item: menuItems,
      })
      .from(menuSchedule)
      .innerJoin(menuItems, eq(menuSchedule.itemId, menuItems.id))
      .where(eq(menuSchedule.date, today));
      
      const uniqueItems = Array.from(new Map(result.map(r => [r.item.id, r.item])).values());
      setMenu(uniqueItems);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchActiveOrders = async () => {
    try {
      const storedOrderIds = await AsyncStorage.getItem('activeOrderIds');
      if (storedOrderIds) {
        const ids = JSON.parse(storedOrderIds);
        if (ids.length > 0) {
          const results = await db.select().from(orders).where(inArray(orders.id, ids));
          // Show orders from the last 24 hours that are not delivered
          const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
          setActiveOrders(results.filter(o => o.status !== 'delivered' || o.createdAt > last24h));
        }
      }
    } catch (error) {
      console.error("Fetch orders error:", error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchTodayMenu();
      fetchActiveOrders();
      
      const interval = setInterval(fetchActiveOrders, 10000);
      return () => clearInterval(interval);
    }, [])
  );

  const addToCart = (id: number) => {
    setCart(prev => ({
      ...prev,
      [id]: (prev[id] || 0) + 1
    }));
  };

  const removeFromCart = (id: number) => {
    setCart(prev => {
      const newCart = { ...prev };
      if (newCart[id] > 1) {
        newCart[id] -= 1;
      } else {
        delete newCart[id];
      }
      return newCart;
    });
  };

  const calculateTotal = () => {
    return menu.reduce((acc, item) => {
      const qty = cart[item.id] || 0;
      return acc + (item.price * qty);
    }, 0);
  };

  const handleCheckout = async () => {
    if (!studentName || !studentClass || !studentMobile) {
      Alert.alert('Missing Info', 'Please fill in all student details');
      return;
    }

    try {
      const total = calculateTotal();
      const [newOrder] = await db.insert(orders).values({
        studentName,
        studentClass,
        studentMobile,
        totalPrice: total,
        status: 'pending'
      }).returning({ id: orders.id });

      const itemsToInsert = Object.entries(cart).map(([itemId, qty]) => {
        const menuItem = menu.find(m => m.id === parseInt(itemId));
        return {
          orderId: newOrder.id,
          itemId: parseInt(itemId),
          quantity: qty,
          priceAtTime: menuItem.price
        };
      });

      await db.insert(orderItems).values(itemsToInsert);

      const storedOrderIds = await AsyncStorage.getItem('activeOrderIds');
      const ids = storedOrderIds ? JSON.parse(storedOrderIds) : [];
      ids.push(newOrder.id);
      await AsyncStorage.setItem('activeOrderIds', JSON.stringify(ids));

      Alert.alert('Order Placed', 'Your order has been sent to the kitchen!');
      setCart({});
      setIsCheckoutModalVisible(false);
      fetchActiveOrders();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to place order');
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
      setIsOrderModalVisible(true);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Could not fetch order details');
    }
  };

  const downloadBill = async (order: any) => {
    if (isGeneratingBill) return;
    setIsGeneratingBill(true);
    try {
      let items = order.items;
      if (!items) {
        items = await db.select({
          name: menuItems.name,
          quantity: orderItems.quantity,
          price: orderItems.priceAtTime
        })
        .from(orderItems)
        .innerJoin(menuItems, eq(orderItems.itemId, menuItems.id))
        .where(eq(orderItems.orderId, order.id));
      }
      await generateProfessionalBill(order, items);
    } catch (error) {
      console.error(error);
    } finally {
      setIsGeneratingBill(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock size={16} color="#FF9800" {...({} as any)} />;
      case 'preparing': return <UtensilsCrossed size={16} color="#2196F3" {...({} as any)} />;
      case 'ready': return <Package size={16} color="#4CAF50" {...({} as any)} />;
      default: return <CheckCircle size={16} color="#9E9E9E" {...({} as any)} />;
    }
  };

  const renderOrder = ({ item }: { item: any }) => (
    <TouchableOpacity 
      onPress={() => viewOrderDetails(item)}
      style={styles.orderCard}
    >
      <View style={styles.orderHeader}>
        <View style={styles.statusBadge}>
          {getStatusIcon(item.status)}
          <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
        </View>
        <ChevronRight size={14} color="#CCC" {...({} as any)} />
      </View>
      <Text style={styles.orderIdText}>Order #{item.id}</Text>
      <Text style={styles.orderDate}>{format(new Date(item.createdAt), 'hh:mm a')}</Text>
    </TouchableOpacity>
  );

  const renderItem = ({ item }: { item: any }) => {
    const qty = cart[item.id] || 0;
    return (
      <View style={styles.card}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.image} />
        ) : (
          <View style={styles.placeholderImage}>
            <UtensilsCrossed size={40} color="#FFB74D" {...({} as any)} />
          </View>
        )}
        <View style={styles.cardContent}>
          <View style={styles.titleRow}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.price}>₹{item.price}</Text>
          </View>
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
          
          <View style={styles.actionRow}>
            {qty > 0 ? (
              <View style={styles.quantitySelector}>
                <TouchableOpacity onPress={() => removeFromCart(item.id)} style={styles.qtyBtn}>
                  <Minus size={20} color="#FF9800" {...({} as any)} />
                </TouchableOpacity>
                <Text style={styles.qtyText}>{qty}</Text>
                <TouchableOpacity onPress={() => addToCart(item.id)} style={styles.qtyBtn}>
                  <Plus size={20} color="#FF9800" {...({} as any)} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={() => addToCart(item.id)} style={styles.addButton}>
                <Plus size={18} color="#fff" style={{ marginRight: 4 }} {...({} as any)} />
                <Text style={styles.addButtonText}>Add to Cart</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Today's Special</Text>
          <Text style={styles.subtitle}>{format(new Date(), 'EEEE, do MMMM')}</Text>
        </View>
        <TouchableOpacity 
          onPress={() => router.push('/login')}
          style={styles.adminButton}
        >
          <LogIn size={20} color="#FF9800" {...({} as any)} />
          <Text style={styles.adminButtonText}>Admin</Text>
        </TouchableOpacity>
      </View>

      {activeOrders.length > 0 && (
        <View style={styles.ordersSection}>
          <Text style={styles.sectionTitle}>Active Orders</Text>
          <FlatList
            data={activeOrders}
            renderItem={renderOrder}
            keyExtractor={item => item.id.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.ordersList}
          />
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FF9800" />
        </View>
      ) : (
        <FlatList
          data={menu}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={fetchTodayMenu} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <UtensilsCrossed size={80} color="#E0E0E0" {...({} as any)} />
              <Text style={styles.emptyText}>No menu available today</Text>
              <Text style={styles.emptySubText}>Check back later!</Text>
            </View>
          }
        />
      )}

      {Object.keys(cart).length > 0 && (
        <View style={styles.cartFooter}>
          <View>
            <Text style={styles.cartCount}>{Object.values(cart).reduce((a, b) => a + b, 0)} Items</Text>
            <Text style={styles.cartTotal}>Total: ₹{calculateTotal()}</Text>
          </View>
          <TouchableOpacity 
            style={styles.checkoutBtn}
            onPress={() => setIsCheckoutModalVisible(true)}
          >
            <ShoppingCart size={20} color="#fff" style={{ marginRight: 8 }} {...({} as any)} />
            <Text style={styles.checkoutText}>Checkout</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Checkout Modal */}
      <Modal visible={isCheckoutModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Student Details</Text>
              <TouchableOpacity onPress={() => setIsCheckoutModalVisible(false)}>
                <X size={24} color="#333" {...({} as any)} />
              </TouchableOpacity>
            </View>
            <View style={styles.form}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput style={styles.modalInput} placeholder="Enter your name" value={studentName} onChangeText={setStudentName} />
              <Text style={styles.label}>Class / Section</Text>
              <TextInput style={styles.modalInput} placeholder="e.g. 10th-A, BBA-1st" value={studentClass} onChangeText={setStudentClass} />
              <Text style={styles.label}>Mobile Number</Text>
              <TextInput style={styles.modalInput} placeholder="10 digit mobile number" value={studentMobile} onChangeText={setStudentMobile} keyboardType="phone-pad" maxLength={10} />
              <TouchableOpacity style={styles.placeOrderBtn} onPress={handleCheckout}>
                <Text style={styles.placeOrderText}>Confirm Order (₹{calculateTotal()})</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Order Detail Modal for Student */}
      <Modal visible={isOrderModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '70%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Order Status</Text>
              <TouchableOpacity onPress={() => setIsOrderModalVisible(false)}>
                <X size={24} color="#333" {...({} as any)} />
              </TouchableOpacity>
            </View>
            {selectedOrder && (
              <ScrollView>
                <View style={styles.detailHeader}>
                  <View style={[styles.statusTag, { backgroundColor: selectedOrder.status === 'ready' ? '#E8F5E9' : '#FFF3E0' }]}>
                    <Text style={[styles.statusTagText, { color: selectedOrder.status === 'ready' ? '#2E7D32' : '#FF9800' }]}>
                      {selectedOrder.status.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.detailId}>Order #{selectedOrder.id}</Text>
                </View>

                <View style={styles.detailItems}>
                  <Text style={styles.sectionTitle}>Your Items</Text>
                  {selectedOrder.items?.map((item: any, idx: number) => (
                    <View key={idx} style={styles.detailItemRow}>
                      <Text style={styles.detailItemName}>{item.name} x {item.quantity}</Text>
                      <Text style={styles.detailItemPrice}>₹{item.price * item.quantity}</Text>
                    </View>
                  ))}
                  <View style={styles.detailTotalRow}>
                    <Text style={styles.detailTotalLabel}>Total Paid</Text>
                    <Text style={styles.detailTotalValue}>₹{selectedOrder.totalPrice}</Text>
                  </View>
                </View>

                <View style={styles.detailActions}>
                  <TouchableOpacity 
                    style={[styles.detailBillBtn, selectedOrder.status !== 'delivered' && styles.disabledBtn]} 
                    onPress={() => downloadBill(selectedOrder)}
                    disabled={selectedOrder.status !== 'delivered'}
                  >
                    <Download size={20} color="#fff" style={{ marginRight: 8 }} {...({} as any)} />
                    <Text style={styles.detailBillText}>Download Bill</Text>
                  </TouchableOpacity>
                  {selectedOrder.status !== 'delivered' && (
                    <Text style={styles.waitText}>Bill will be available once the order is DELIVERED</Text>
                  )}
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
  header: { padding: 20, paddingTop: 60, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  subtitle: { fontSize: 14, color: '#666', marginTop: 4 },
  adminButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3E0', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  adminButtonText: { marginLeft: 6, color: '#FF9800', fontWeight: '600' },
  ordersSection: { padding: 15 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  ordersList: { paddingRight: 20 },
  orderCard: { backgroundColor: '#fff', padding: 12, borderRadius: 12, marginRight: 12, width: 140, borderWidth: 1, borderColor: '#E0E0E0', elevation: 2 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  statusBadge: { flexDirection: 'row', alignItems: 'center' },
  statusText: { fontSize: 9, fontWeight: 'bold', marginLeft: 4, color: '#666' },
  orderIdText: { fontSize: 12, fontWeight: 'bold', color: '#333', marginTop: 2 },
  orderDate: { fontSize: 11, color: '#999', marginTop: 2 },
  list: { padding: 15, paddingBottom: 100 },
  card: { backgroundColor: '#fff', borderRadius: 16, marginBottom: 20, overflow: 'hidden', elevation: 3 },
  image: { width: '100%', height: 180 },
  placeholderImage: { width: '100%', height: 180, backgroundColor: '#FFF3E0', justifyContent: 'center', alignItems: 'center' },
  cardContent: { padding: 16 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  itemName: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  price: { fontSize: 18, fontWeight: 'bold', color: '#FF9800' },
  description: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 16 },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  addButton: { backgroundColor: '#FF9800', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  addButtonText: { color: '#fff', fontWeight: 'bold' },
  quantitySelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3E0', borderRadius: 10, borderWidth: 1, borderColor: '#FFB74D' },
  qtyBtn: { padding: 8 },
  qtyText: { fontSize: 16, fontWeight: 'bold', color: '#333', paddingHorizontal: 8 },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { fontSize: 20, fontWeight: 'bold', color: '#999', marginTop: 16 },
  emptySubText: { fontSize: 14, color: '#AAA', marginTop: 8 },
  cartFooter: { position: 'absolute', bottom: 20, left: 20, right: 20, backgroundColor: '#333', padding: 16, borderRadius: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 5 },
  cartCount: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  cartTotal: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  checkoutBtn: { backgroundColor: '#FF9800', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  checkoutText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  form: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#666', marginBottom: 8 },
  modalInput: { backgroundColor: '#F5F5F5', height: 50, borderRadius: 12, paddingHorizontal: 16, fontSize: 16, marginBottom: 16, borderWidth: 1, borderColor: '#EEE' },
  placeOrderBtn: { backgroundColor: '#FF9800', height: 55, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  placeOrderText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  // Detail Modal Styles
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  statusTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusTagText: { fontSize: 12, fontWeight: 'bold' },
  detailId: { fontSize: 16, color: '#999', fontWeight: '500' },
  detailItems: { backgroundColor: '#F9F9F9', padding: 16, borderRadius: 12, marginBottom: 20 },
  detailItemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  detailItemName: { fontSize: 15, color: '#444' },
  detailItemPrice: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  detailTotalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, paddingTop: 10, borderTopWidth: 2, borderTopColor: '#DDD' },
  detailTotalLabel: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  detailTotalValue: { fontSize: 18, fontWeight: 'bold', color: '#FF9800' },
  detailActions: { alignItems: 'center' },
  detailBillBtn: { backgroundColor: '#FF9800', flexDirection: 'row', alignItems: 'center', width: '100%', height: 55, borderRadius: 12, justifyContent: 'center' },
  detailBillText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  disabledBtn: { backgroundColor: '#CCC' },
  waitText: { fontSize: 12, color: '#999', marginTop: 10, textAlign: 'center' },
});
