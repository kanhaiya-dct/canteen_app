import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  TouchableOpacity, 
  Alert,
  ActivityIndicator,
  Image
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import { db } from '../../db/drizzle';
import { menuItems, menuSchedule } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { Plus, Edit2, Trash2, LogOut, Calendar, Package } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AdminDashboardScreen() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = async () => {
    try {
      const allItems = await db.select().from(menuItems);
      
      const itemsWithDates = await Promise.all(allItems.map(async (item) => {
        const schedules = await db.select()
          .from(menuSchedule)
          .where(eq(menuSchedule.itemId, item.id));
        return {
          ...item,
          dates: schedules.map(s => s.date)
        };
      }));
      
      setItems(itemsWithDates);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      const checkAuth = async () => {
        const admin = await AsyncStorage.getItem('isAdmin');
        if (admin !== 'true') {
          router.replace('/login');
        }
      };
      checkAuth();
      fetchItems();
    }, [])
  );

  const handleLogout = async () => {
    await AsyncStorage.removeItem('isAdmin');
    router.replace('/');
  };

  const handleDelete = (id: number) => {
    Alert.alert(
      'Delete Item',
      'Are you sure you want to delete this item and all its scheduled dates?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            // Delete image file if exists
            const item = await db.select().from(menuItems).where(eq(menuItems.id, id)).get();
            const fs = FileSystem as any;
            if (item?.image && fs.documentDirectory && item.image.startsWith(fs.documentDirectory)) {
              try {
                await fs.deleteAsync(item.image, { idempotent: true });
              } catch (e) {
                console.error("Failed to delete image file", e);
              }
            }
            await db.delete(menuItems).where(eq(menuItems.id, id));
            fetchItems();
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.itemRow}>
      {item.image ? (
        <Image source={{ uri: item.image }} style={styles.itemThumbnail} />
      ) : (
        <View style={styles.placeholderThumbnail}>
          <Calendar size={20} color="#FF9800" {...({} as any)} />
        </View>
      )}
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemPrice}>₹{item.price}</Text>
        <Text style={styles.datesLabel} numberOfLines={1}>
          Scheduled: {item.dates.length > 0 ? item.dates.join(', ') : 'None'}
        </Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity 
          onPress={() => router.push({ pathname: '/admin/add-edit', params: { itemId: item.id } })}
          style={styles.actionButton}
        >
          <Edit2 size={20} color="#2196F3" {...({} as any)} />
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => handleDelete(item.id)}
          style={styles.actionButton}
        >
          <Trash2 size={20} color="#F44336" {...({} as any)} />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF9800" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Management</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            onPress={() => router.push('/admin/orders')} 
            style={styles.ordersLink}
          >
            <Package size={20} color="#FF9800" {...({} as any)} />
            <Text style={styles.ordersLinkText}>Orders</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <LogOut size={20} color="#F44336" {...({} as any)} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No items found. Add your first dish!</Text>
          </View>
        }
      />

      <TouchableOpacity 
        style={styles.fab}
        onPress={() => router.push('/admin/add-edit')}
      >
        <Plus size={30} color="#fff" {...({} as any)} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ordersLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 10,
  },
  ordersLinkText: {
    color: '#FF9800',
    fontWeight: 'bold',
    marginLeft: 4,
    fontSize: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  logoutButton: {
    padding: 8,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  itemRow: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  itemThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  placeholderThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  itemPrice: {
    fontSize: 14,
    color: '#E65100',
    fontWeight: '600',
    marginTop: 2,
  },
  datesLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 4,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF9800',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
  },
});
