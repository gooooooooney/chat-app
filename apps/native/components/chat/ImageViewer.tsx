import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Pressable,
  Dimensions,
  StatusBar,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  clamp,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import { Text } from '@/components/ui/text';
import { X, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const AnimatedImage = Animated.createAnimatedComponent(Image);

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ImageViewerProps {
  visible: boolean;
  images: Array<{
    imageUrl: string;
    _id: string;
  }>;
  initialIndex: number;
  onClose: () => void;
}

interface ImageSize {
  width: number;
  height: number;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  visible,
  images,
  initialIndex,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [imageSize, setImageSize] = useState<ImageSize>({ width: SCREEN_WIDTH, height: SCREEN_HEIGHT });
  const [isLoading, setIsLoading] = useState(true);

  // Shared values for gestures
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Get current image
  const currentImage = images[currentIndex];

  // Calculate image display size
  const calculateImageSize = useCallback((imgWidth: number, imgHeight: number): ImageSize => {
    const widthRatio = SCREEN_WIDTH / imgWidth;
    const heightRatio = SCREEN_HEIGHT / imgHeight;
    const ratio = Math.min(widthRatio, heightRatio);

    return {
      width: imgWidth * ratio,
      height: imgHeight * ratio,
    };
  }, []);

  // Prefetch adjacent images
  useEffect(() => {
    const indicesToPrefetch = [
      currentIndex - 1,
      currentIndex + 1,
    ].filter(i => i >= 0 && i < images.length);

    const imagesToPrefetch = indicesToPrefetch.map(i => images[i].imageUrl);

    if (imagesToPrefetch.length > 0) {
      Image.prefetch(imagesToPrefetch, 'memory-disk').catch(error => {
        console.error('Failed to prefetch images:', error);
      });
    }
  }, [currentIndex, images]);

  // Load current image
  useEffect(() => {
    if (!currentImage) return;

    setIsLoading(true);
    // expo-image will handle the loading automatically
    // We just set a default size and let the image load
    setImageSize({ width: SCREEN_WIDTH, height: SCREEN_HEIGHT });

    // Set loading to false after a short delay
    const timer = setTimeout(() => setIsLoading(false), 100);
    return () => clearTimeout(timer);
  }, [currentImage]);

  // Reset all gesture values
  const resetGestureValues = useCallback(() => {
    'worklet';
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, [scale, savedScale, translateX, translateY, savedTranslateX, savedTranslateY]);

  // Calculate pan boundaries based on current scale
  const getPanBounds = useCallback(() => {
    'worklet';
    const scaledWidth = imageSize.width * scale.value;
    const scaledHeight = imageSize.height * scale.value;

    const maxTranslateX = Math.max(0, (scaledWidth - SCREEN_WIDTH) / 2);
    const maxTranslateY = Math.max(0, (scaledHeight - SCREEN_HEIGHT) / 2);

    return {
      minX: -maxTranslateX,
      maxX: maxTranslateX,
      minY: -maxTranslateY,
      maxY: maxTranslateY,
    };
  }, [imageSize, scale]);

  // Change image with animation
  const changeImage = useCallback((direction: 1 | -1) => {
    const newIndex = currentIndex + direction;
    if (newIndex < 0 || newIndex >= images.length) return;

    // Animate out
    const targetX = direction === 1 ? -SCREEN_WIDTH : SCREEN_WIDTH;
    translateX.value = withTiming(targetX, { duration: 200 }, () => {
      // Update index
      runOnJS(setCurrentIndex)(newIndex);

      // Reset from opposite side
      translateX.value = -targetX;
      translateX.value = withTiming(0, { duration: 200 });

      // Reset all gesture values
      scale.value = withTiming(1);
      translateY.value = withTiming(0);
      savedScale.value = 1;
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    });
  }, [currentIndex, images.length, translateX, translateY, scale, savedScale, savedTranslateX, savedTranslateY]);

  // Pinch Gesture (缩放)
  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      const newScale = clamp(savedScale.value * event.scale, 1, 5);
      scale.value = newScale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;

      // Adjust position if out of bounds
      const bounds = getPanBounds();
      if (Math.abs(translateX.value) > 0 || Math.abs(translateY.value) > 0) {
        translateX.value = withSpring(clamp(translateX.value, bounds.minX, bounds.maxX));
        translateY.value = withSpring(clamp(translateY.value, bounds.minY, bounds.maxY));
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      }
    });

  // Double Tap Gesture (双击放大/缩小)
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        // 缩小到 1x
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        // 放大到 3x
        scale.value = withSpring(3);
        savedScale.value = 3;
      }
    });

  // Pan Gesture (拖拽/滑动)
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (scale.value > 1) {
        // 放大状态：允许拖拽移动
        translateX.value = savedTranslateX.value + event.translationX;
        translateY.value = savedTranslateY.value + event.translationY;
      } else {
        // 未放大：仅允许横向滑动切换图片
        translateX.value = event.translationX;
        translateY.value = 0;
      }
    })
    .onEnd((event) => {
      if (scale.value > 1) {
        // 放大状态：应用边界约束
        const bounds = getPanBounds();
        translateX.value = withSpring(clamp(translateX.value, bounds.minX, bounds.maxX));
        translateY.value = withSpring(clamp(translateY.value, bounds.minY, bounds.maxY));
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      } else {
        // 未放大：判断是否切换图片
        const threshold = 100;
        const velocity = Math.abs(event.velocityX);
        const shouldGoNext =
          (event.translationX < -threshold || (event.translationX < -50 && velocity > 500)) &&
          currentIndex < images.length - 1;
        const shouldGoPrev =
          (event.translationX > threshold || (event.translationX > 50 && velocity > 500)) &&
          currentIndex > 0;

        if (shouldGoNext) {
          runOnJS(changeImage)(1);
        } else if (shouldGoPrev) {
          runOnJS(changeImage)(-1);
        } else {
          // 回弹
          translateX.value = withSpring(0);
        }
      }
    });

  // Compose gestures
  const composedGesture = Gesture.Simultaneous(
    pinchGesture,
    Gesture.Exclusive(doubleTapGesture, panGesture)
  );

  // Animated style
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  // Handle navigation buttons
  const handlePrevious = () => {
    changeImage(-1);
  };

  const handleNext = () => {
    changeImage(1);
  };

  // Reset when modal closes
  useEffect(() => {
    if (!visible) {
      resetGestureValues();
      setCurrentIndex(initialIndex);
    }
  }, [visible, initialIndex, resetGestureValues]);

  if (!currentImage) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar hidden />
      <GestureHandlerRootView style={styles.gestureRoot}>
        <View style={styles.container}>
          {/* Image with gestures */}
          <GestureDetector gesture={composedGesture}>
            <Animated.View style={styles.imageWrapper}>
              <AnimatedImage
                source={{ uri: currentImage.imageUrl }}
                style={[
                  {
                    width: SCREEN_WIDTH,
                    height: SCREEN_HEIGHT,
                  },
                  animatedStyle,
                ]}
                contentFit="contain"
                cachePolicy="memory-disk"
                transition={200}
                onLoadStart={() => setIsLoading(true)}
                onLoad={() => setIsLoading(false)}
                onError={() => setIsLoading(false)}
              />
            </Animated.View>
          </GestureDetector>

          {/* Loading indicator */}
          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="white" />
            </View>
          )}

          {/* Top bar: Close button and counter */}
          <View
            style={[
              styles.topBar,
              { paddingTop: insets.top || 12 },
            ]}
          >
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={8}
            >
              <Icon as={X} size={28} className="text-white" />
            </Pressable>

            <View style={styles.counter}>
              <Text className="text-white text-base font-medium">
                {currentIndex + 1} / {images.length}
              </Text>
            </View>
          </View>

          {/* Navigation buttons */}
          {images.length > 1 && (
            <>
              {/* Previous button */}
              {currentIndex > 0 && (
                <Pressable
                  onPress={handlePrevious}
                  style={[styles.navButton, styles.navButtonLeft]}
                  hitSlop={8}
                >
                  <Icon as={ChevronLeft} size={32} className="text-white" />
                </Pressable>
              )}

              {/* Next button */}
              {currentIndex < images.length - 1 && (
                <Pressable
                  onPress={handleNext}
                  style={[styles.navButton, styles.navButtonRight]}
                  hitSlop={8}
                >
                  <Icon as={ChevronRight} size={32} className="text-white" />
                </Pressable>
              )}
            </>
          )}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  closeButton: {
    padding: 8,
  },
  counter: {
    padding: 8,
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -24,
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 24,
  },
  navButtonLeft: {
    left: 16,
  },
  navButtonRight: {
    right: 16,
  },
});
