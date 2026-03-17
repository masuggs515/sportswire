import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

class ShimmerCard extends StatelessWidget {
  const ShimmerCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: const Color(0xFF1A1A2E),
      highlightColor: const Color(0xFF2A2A3E),
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFF1A1A2E),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // League badge + timestamp row
            Row(
              children: [
                _box(width: 40, height: 18),
                const SizedBox(width: 8),
                _box(width: 60, height: 12),
                const Spacer(),
                _box(width: 50, height: 12),
              ],
            ),
            const SizedBox(height: 12),
            // Headline
            _box(width: double.infinity, height: 16),
            const SizedBox(height: 6),
            _box(width: double.infinity * 0.8, height: 16),
            const SizedBox(height: 10),
            // Summary
            _box(width: double.infinity, height: 12),
            const SizedBox(height: 4),
            _box(width: double.infinity, height: 12),
            const SizedBox(height: 4),
            _box(width: 200, height: 12),
            const SizedBox(height: 12),
            // Tags row
            Row(
              children: [
                _box(width: 50, height: 20),
                const SizedBox(width: 6),
                _box(width: 50, height: 20),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _box({required double width, required double height}) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(4),
      ),
    );
  }
}

class ShimmerGameTile extends StatelessWidget {
  const ShimmerGameTile({super.key});

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: const Color(0xFF1A1A2E),
      highlightColor: const Color(0xFF2A2A3E),
      child: Container(
        width: 140,
        margin: const EdgeInsets.only(left: 12),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFF1A1A2E),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _box(width: 80, height: 12),
            const SizedBox(height: 8),
            _box(width: 60, height: 20),
            const SizedBox(height: 8),
            _box(width: 50, height: 12),
          ],
        ),
      ),
    );
  }

  Widget _box({required double width, required double height}) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(4),
      ),
    );
  }
}
