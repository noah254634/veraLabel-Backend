import logger from '../config/logger.js';

// Pricing tiers based on task volume
const PRICING_TIERS = {
  rlhf: {
    baserate: 1.5,  // $1.50 per unit (RLHF is complex, high value)
    description: 'RLHF (Reinforcement Learning from Human Feedback)',
    tier_multipliers: {
      small: 1.0,     // 1-100 units
      medium: 0.9,    // 101-1000 units (-10% volume discount)
      large: 0.8,     // 1001-10000 units (-20% volume discount)
      enterprise: 0.7 // 10000+ units (-30% volume discount)
    }
  },
  images: {
    baserate: 0.50,  // $0.50 per image (faster than RLHF, lower complexity)
    description: 'Image annotation/labeling',
    tier_multipliers: {
      small: 1.0,
      medium: 0.95,   // -5% for volume
      large: 0.85,    // -15% for volume
      enterprise: 0.75 // -25% for volume
    }
  },
  videos: {
    baserate: 1.5,   // $1.50 per unit (time-consuming, high complexity)
    description: 'Video annotation/labeling',
    tier_multipliers: {
      small: 1.0,
      medium: 0.9,
      large: 0.8,
      enterprise: 0.7
    }
  },
  audio: {
    baserate: 0.75,  // $0.75 per unit (transcription/annotation)
    description: 'Audio transcription/annotation',
    tier_multipliers: {
      small: 1.0,
      medium: 0.9,
      large: 0.8,
      enterprise: 0.7
    }
  },
  text: {
    baserate: 0.60,  // $0.60 per unit (straightforward but high volume)
    description: 'Text annotation/labeling',
    tier_multipliers: {
      small: 1.0,
      medium: 0.95,
      large: 0.85,
      enterprise: 0.75
    }
  },
  code: {
    baserate: 1.25,  // $1.25 per unit (requires expertise)
    description: 'Code review/annotation',
    tier_multipliers: {
      small: 1.0,
      medium: 0.9,
      large: 0.8,
      enterprise: 0.7
    }
  },
};

// Cost multipliers (percentage of base price to add as overhead)
const COST_MULTIPLIERS = {
  engineering: 0.2,      // 20% engineering overhead
  maintenance: 0.25,     // 25% maintenance cost (on subtotal)
  platform: 0.15,        // 15% platform fee
};

/**
 * Determine pricing tier based on volume
 */
const getPricingTier = (rowsCount) => {
  if (rowsCount <= 100) return 'small';
  if (rowsCount <= 1000) return 'medium';
  if (rowsCount <= 10000) return 'large';
  return 'enterprise';
};

/**
 * Calculate effective rate based on volume
 */
const getEffectiveRate = (taskType, rowsCount) => {
  const normalizedType = String(taskType || "").trim().toLowerCase();
  
  if (!PRICING_TIERS[normalizedType]) {
    throw new Error(`Unsupported task type for invoicing: ${taskType}`);
  }

  const tier = getPricingTier(rowsCount);
  const rateInfo = PRICING_TIERS[normalizedType];
  const multiplier = rateInfo.tier_multipliers[tier];

  if (multiplier === undefined) {
    throw new Error(`Invalid pricing tier: ${tier}`);
  }

  const effectiveRate = rateInfo.baserate * multiplier;

  return { tier, effectiveRate, baserate: rateInfo.baserate, multiplier };
};

export const invoiceService = {
  /**
   * Generate detailed invoice with breakdown
   */
  generateInvoice: async (taskType, rowsCount) => {
    try {
      // Validate inputs
      if (!taskType || typeof taskType !== 'string') {
        throw new Error('taskType is required and must be a string');
      }

      if (!Number.isInteger(rowsCount) || rowsCount < 0) {
        throw new Error(`rowsCount must be a non-negative integer, got: ${rowsCount}`);
      }

      if (rowsCount === 0) {
        logger.warn('Invoice generated for zero rows', { taskType, rowsCount });
        return {
          price: 0,
          basePrice: 0,
          engineeringCost: 0,
          platformFee: 0,
          maintenanceCost: 0,
          totalCost: 0,
          currency: "USD",
          rowsCount,
          taskType,
          tier: 'small',
          breakdown: {
            items: 0,
            unitRate: 0,
            discount: 0,
          },
        };
      }

      const normalizedType = String(taskType || "").trim().toLowerCase();

      if (!PRICING_TIERS[normalizedType]) {
        throw new Error(`Unsupported task type for invoicing: ${taskType}`);
      }

      // Get pricing information
      const { tier, effectiveRate, baserate, multiplier } = getEffectiveRate(normalizedType, rowsCount);
      const rateInfo = PRICING_TIERS[normalizedType];

      // Calculate base price
      const basePrice = rowsCount * effectiveRate;
      
      // Calculate costs and fees
      const engineeringCost = basePrice * COST_MULTIPLIERS.engineering;
      const platformFee = basePrice * COST_MULTIPLIERS.platform;
      const subtotal = basePrice + engineeringCost + platformFee;
      const maintenanceCost = subtotal * COST_MULTIPLIERS.maintenance;
      const totalCost = subtotal + maintenanceCost;

      // Calculate effective discount
      const discountedAmount = rowsCount * baserate - basePrice;
      const discountPercent = ((baserate - effectiveRate) / baserate * 100).toFixed(2);

      const invoice = {
        // Basic info
        taskType: normalizedType,
        description: rateInfo.description,
        rowsCount,
        currency: "USD",

        // Pricing details
        tier,
        unitRate: effectiveRate,
        baseRate: baserate,
        tierMultiplier: multiplier,

        // Costs breakdown
        breakdown: {
          items: rowsCount,
          unitRate: effectiveRate,
          basePrice,
          discount: discountedAmount,
          discountPercent: isFinite(discountPercent) ? parseFloat(discountPercent) : 0,
          engineering: engineeringCost,
          platform: platformFee,
          maintenance: maintenanceCost,
        },

        // Totals
        price: basePrice,
        basePrice,
        engineeringCost,
        platformFee,
        maintenanceCost,
        totalCost: parseFloat(totalCost.toFixed(2)),

        // Metadata
        calculatedAt: new Date().toISOString(),
      };

      logger.info('Invoice generated', {
        taskType: normalizedType,
        rowsCount,
        tier,
        basePrice: basePrice.toFixed(2),
        totalCost: totalCost.toFixed(2),
        discount: discountPercent,
      });

      return invoice;
    } catch (error) {
      logger.error('Error generating invoice', {
        error: error.message,
        stack: error.stack,
        taskType,
        rowsCount,
      });
      throw error;
    }
  },

  /**
   * Get pricing structure for a task type
   */
  getPricingInfo: (taskType) => {
    try {
      const normalizedType = String(taskType || "").trim().toLowerCase();

      if (!PRICING_TIERS[normalizedType]) {
        throw new Error(`Unsupported task type: ${taskType}`);
      }

      const info = PRICING_TIERS[normalizedType];

      return {
        taskType: normalizedType,
        description: info.description,
        baseRate: info.baserate,
        tiers: Object.entries(info.tier_multipliers).map(([tierName, multiplier]) => ({
          name: tierName,
          multiplier,
          effectiveRate: (info.baserate * multiplier).toFixed(4),
        })),
      };
    } catch (error) {
      logger.error('Error getting pricing info', {
        error: error.message,
        taskType,
      });
      throw error;
    }
  },

  /**
   * Get all supported task types with pricing
   */
  getAllPricingTiers: () => {
    const tiers = [];

    for (const [taskType, info] of Object.entries(PRICING_TIERS)) {
      tiers.push({
        taskType,
        description: info.description,
        baseRate: info.baserate,
        tiers: Object.entries(info.tier_multipliers).map(([tierName, multiplier]) => ({
          name: tierName,
          multiplier,
          effectiveRate: (info.baserate * multiplier).toFixed(4),
        })),
      });
    }

    return tiers;
  },
};