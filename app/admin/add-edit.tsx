import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView,
  Image,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import { db } from '../../db/drizzle';
import { menuItems, menuSchedule } from '../../db/schema';
import { eq } from 'drizzle-orm';
import * as ImagePicker from 'expo-image-picker';
import { Calendar } from 'react-native-calendars';
import { Camera, Save, X, Calendar as CalendarIcon } from 'lucide-react-native';

export default function AddEditItemScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const itemId = params.itemId ? parseInt(params.itemId as string) : undefined;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [selectedDates, setSelectedDates] = useState<{[key: string]: any}>({});
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!!itemId);

  useEffect(() => {
    if (itemId) {
      fetchItemDetails();
    }
  }, [itemId]);

  const fetchItemDetails = async () => {
    try {
      const item = await db.select().from(menuItems).where(eq(menuItems.id, itemId!)).limit(1);
      if (item && item.length > 0) {
        const itemData = item[0];
        setName(itemData.name);
        setDescription(itemData.description);
        setPrice(itemData.price.toString());
        setImage(itemData.image);
        
        const schedules = await db.select().from(menuSchedule).where(eq(menuSchedule.itemId, itemId!));
        const datesObj: any = {};
        schedules.forEach(s => {
          datesObj[s.date] = { selected: true, selectedColor: '#FF9800' };
        });
        setSelectedDates(datesObj);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setFetching(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!result.canceled) {
      // For production: Copy image to permanent storage
      try {
        const uri = result.assets[0].uri;
        const filename = uri.split('/').pop() || `img_${Date.now()}.jpg`;
        
        const fs = FileSystem as any;
        if (fs.documentDirectory) {
          const newPath = fs.documentDirectory + filename;
          await fs.copyAsync({ from: uri, to: newPath });
          setImage(newPath);
        } else {
          setImage(uri);
        }
      } catch (e) {
        console.error("Image copy failed", e);
        setImage(result.assets[0].uri); // Fallback
      }
    }
  };

  const onDayPress = (day: any) => {
    const dateString = day.dateString;
    const newSelectedDates = { ...selectedDates };
    
    if (newSelectedDates[dateString]) {
      delete newSelectedDates[dateString];
    } else {
      newSelectedDates[dateString] = { selected: true, selectedColor: '#FF9800' };
    }
    
    setSelectedDates(newSelectedDates);
  };

  const handleSave = async () => {
    if (!name || !description || !price) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      let currentItemId = itemId;
      
      if (itemId) {
        // Update item
        await db.update(menuItems)
          .set({ name, description, price: parseFloat(price), image })
          .where(eq(menuItems.id, itemId));
        
        // Update schedules: Delete existing and re-insert
        await db.delete(menuSchedule).where(eq(menuSchedule.itemId, itemId));
      } else {
        // Create item
        const result = await db.insert(menuItems)
          .values({ name, description, price: parseFloat(price), image })
          .returning({ id: menuItems.id });
        currentItemId = result[0].id;
      }

      // Insert schedules
      const dateStrings = Object.keys(selectedDates);
      if (dateStrings.length > 0) {
        const scheduleValues = dateStrings.map(date => ({
          itemId: currentItemId!,
          date
        }));
        await db.insert(menuSchedule).values(scheduleValues);
      }

      Alert.alert('Success', 'Item saved successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to save item');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF9800" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.form}>
        <TouchableOpacity style={styles.imagePicker} onPress={pickImage} activeOpacity={0.7}>
          {image ? (
            <Image source={{ uri: image }} style={styles.previewImage} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Camera size={40} color="#FF9800" />
              <Text style={styles.imagePlaceholderText}>Add Food Image</Text>
            </View>
          )}
          {image && (
            <TouchableOpacity style={styles.removeImage} onPress={() => setImage(null)}>
              <X size={16} color="#fff" {...({} as any)} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Item Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Masala Dosa"
            value={name}
            onChangeText={setName}
            placeholderTextColor="#AAA"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="What's in it?"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            placeholderTextColor="#AAA"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Price (₹)</Text>
          <TextInput
            style={styles.input}
            placeholder="0.00"
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
            placeholderTextColor="#AAA"
          />
        </View>

        <View style={styles.inputGroup}>
          <View style={styles.labelRow}>
            <CalendarIcon size={18} color="#FF9800" />
            <Text style={[styles.label, { marginLeft: 8, marginBottom: 0 }]}>Assign to Dates</Text>
          </View>
          <Text style={styles.hint}>Tap dates on the calendar to schedule this item</Text>
          <View style={styles.calendarContainer}>
            <Calendar
              onDayPress={onDayPress}
              markedDates={selectedDates}
              theme={{
                todayTextColor: '#FF9800',
                arrowColor: '#FF9800',
                selectedDayBackgroundColor: '#FF9800',
                selectedDayTextColor: '#ffffff',
                dotColor: '#FF9800',
              }}
            />
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.saveButton, loading && styles.disabledButton]} 
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Save size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Save Menu Item</Text>
            </>
          )}
        </TouchableOpacity>
        
        <View style={{ height: 40 }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  form: {
    padding: 20,
  },
  imagePicker: {
    width: '100%',
    height: 200,
    backgroundColor: '#FFF3E0',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#FFE0B2',
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    alignItems: 'center',
  },
  imagePlaceholderText: {
    marginTop: 8,
    color: '#FF9800',
    fontWeight: '600',
  },
  removeImage: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 15,
    padding: 4,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#444',
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    color: '#333',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    color: '#888',
    marginBottom: 12,
  },
  calendarContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  saveButton: {
    backgroundColor: '#FF9800',
    flexDirection: 'row',
    height: 55,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  disabledButton: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
});
