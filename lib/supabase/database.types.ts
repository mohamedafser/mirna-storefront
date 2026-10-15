// Database types in `supabase gen types typescript` format, for the SHARED
// schema owned by mirna-admin (supabase/migrations lives there, not here).
// Never edit by hand in this repo: after an admin migration, run
// `npm run db:types` (or copy mirna-admin/lib/supabase/database.types.ts).
// (Hand-written in mirna-admin for Phase 1 to match its migrations; replace with the
// generated output once a project is linked.)

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  public: {
    Tables: {
      addresses: {
        Row: {
          additional_instructions: string | null;
          apartment: string | null;
          area: string | null;
          building: string | null;
          city: string;
          country_code: string;
          created_at: string;
          full_name: string;
          id: string;
          is_default: boolean;
          label: string | null;
          phone: string;
          postal_code: string | null;
          state_region: string | null;
          street: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          additional_instructions?: string | null;
          apartment?: string | null;
          area?: string | null;
          building?: string | null;
          city: string;
          country_code: string;
          created_at?: string;
          full_name: string;
          id?: string;
          is_default?: boolean;
          label?: string | null;
          phone: string;
          postal_code?: string | null;
          state_region?: string | null;
          street?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          additional_instructions?: string | null;
          apartment?: string | null;
          area?: string | null;
          building?: string | null;
          city?: string;
          country_code?: string;
          created_at?: string;
          full_name?: string;
          id?: string;
          is_default?: boolean;
          label?: string | null;
          phone?: string;
          postal_code?: string | null;
          state_region?: string | null;
          street?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "addresses_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      attribute_values: {
        Row: {
          attribute_id: string;
          color_hex: string | null;
          created_at: string;
          id: string;
          is_active: boolean;
          sort_order: number;
          updated_at: string;
          value: string;
        };
        Insert: {
          attribute_id: string;
          color_hex?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          sort_order?: number;
          updated_at?: string;
          value: string;
        };
        Update: {
          attribute_id?: string;
          color_hex?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          sort_order?: number;
          updated_at?: string;
          value?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attribute_values_attribute_id_fkey";
            columns: ["attribute_id"];
            isOneToOne: false;
            referencedRelation: "attributes";
            referencedColumns: ["id"];
          },
        ];
      };
      attributes: {
        Row: {
          allows_multiple: boolean;
          code: string;
          created_at: string;
          data_type: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          unit: string | null;
          updated_at: string;
        };
        Insert: {
          allows_multiple?: boolean;
          code: string;
          created_at?: string;
          data_type: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          unit?: string | null;
          updated_at?: string;
        };
        Update: {
          allows_multiple?: boolean;
          code?: string;
          created_at?: string;
          data_type?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          unit?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      cart_items: {
        Row: {
          created_at: string;
          id: string;
          product_id: string;
          quantity: number;
          updated_at: string;
          user_id: string;
          variant_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          product_id: string;
          quantity: number;
          updated_at?: string;
          user_id?: string;
          variant_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          product_id?: string;
          quantity?: number;
          updated_at?: string;
          user_id?: string;
          variant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cart_items_variant_fkey";
            columns: ["product_id", "variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["product_id", "id"];
          },
        ];
      };
      categories: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          image_path: string | null;
          image_url: string | null;
          is_active: boolean;
          name: string;
          parent_id: string | null;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          image_path?: string | null;
          image_url?: string | null;
          is_active?: boolean;
          name: string;
          parent_id?: string | null;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          image_path?: string | null;
          image_url?: string | null;
          is_active?: boolean;
          name?: string;
          parent_id?: string | null;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      hero_slides: {
        Row: {
          image_path: string;
          image_url: string;
          position: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          image_path: string;
          image_url: string;
          position: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          image_path?: string;
          image_url?: string;
          position?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      inventory: {
        Row: {
          created_at: string;
          id: string;
          low_stock_threshold: number;
          product_id: string;
          quantity: number;
          reserved_quantity: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          low_stock_threshold?: number;
          product_id: string;
          quantity?: number;
          reserved_quantity?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          low_stock_threshold?: number;
          product_id?: string;
          quantity?: number;
          reserved_quantity?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: true;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_adjustments: {
        Row: {
          adjustment_quantity: number;
          adjustment_type: Database["public"]["Enums"]["inventory_adjustment_type"];
          created_at: string;
          created_by: string | null;
          id: string;
          inventory_id: string;
          notes: string | null;
          product_id: string;
          quantity_after: number;
          quantity_before: number;
          reason: Database["public"]["Enums"]["inventory_adjustment_reason"];
        };
        Insert: {
          adjustment_quantity: number;
          adjustment_type: Database["public"]["Enums"]["inventory_adjustment_type"];
          created_at?: string;
          created_by?: string | null;
          id?: string;
          inventory_id: string;
          notes?: string | null;
          product_id: string;
          quantity_after: number;
          quantity_before: number;
          reason: Database["public"]["Enums"]["inventory_adjustment_reason"];
        };
        Update: {
          adjustment_quantity?: number;
          adjustment_type?: Database["public"]["Enums"]["inventory_adjustment_type"];
          created_at?: string;
          created_by?: string | null;
          id?: string;
          inventory_id?: string;
          notes?: string | null;
          product_id?: string;
          quantity_after?: number;
          quantity_before?: number;
          reason?: Database["public"]["Enums"]["inventory_adjustment_reason"];
        };
        Relationships: [
          {
            foreignKeyName: "inventory_adjustments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_adjustments_inventory_id_fkey";
            columns: ["inventory_id"];
            isOneToOne: false;
            referencedRelation: "inventory";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_adjustments_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          created_at: string;
          currency_code: string;
          id: string;
          order_id: string;
          product_id: string | null;
          product_name: string;
          quantity: number;
          sku: string;
          total_price: number;
          unit_price: number;
          variant_id: string | null;
          variant_label: string | null;
        };
        Insert: {
          created_at?: string;
          currency_code: string;
          id?: string;
          order_id: string;
          product_id?: string | null;
          product_name: string;
          quantity: number;
          sku: string;
          total_price: number;
          unit_price: number;
          variant_id?: string | null;
          variant_label?: string | null;
        };
        Update: {
          created_at?: string;
          currency_code?: string;
          id?: string;
          order_id?: string;
          product_id?: string | null;
          product_name?: string;
          quantity?: number;
          sku?: string;
          total_price?: number;
          unit_price?: number;
          variant_id?: string | null;
          variant_label?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_fkey";
            columns: ["order_id", "currency_code"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id", "currency_code"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          billing_address_snapshot: Json | null;
          checkout_key: string | null;
          created_at: string;
          currency_code: string;
          discount: number;
          id: string;
          order_number: number;
          shipping: number;
          shipping_address_snapshot: Json;
          status: Database["public"]["Enums"]["order_status"];
          subtotal: number;
          tax: number;
          total: number;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          billing_address_snapshot?: Json | null;
          checkout_key?: string | null;
          created_at?: string;
          currency_code: string;
          discount?: number;
          id?: string;
          order_number?: never;
          shipping?: number;
          shipping_address_snapshot: Json;
          status?: Database["public"]["Enums"]["order_status"];
          subtotal: number;
          tax?: number;
          total: number;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          billing_address_snapshot?: Json | null;
          checkout_key?: string | null;
          created_at?: string;
          currency_code?: string;
          discount?: number;
          id?: string;
          order_number?: never;
          shipping?: number;
          shipping_address_snapshot?: Json;
          status?: Database["public"]["Enums"]["order_status"];
          subtotal?: number;
          tax?: number;
          total?: number;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      product_attributes: {
        Row: {
          attribute_id: string;
          attribute_value_id: string | null;
          created_at: string;
          id: string;
          product_id: string;
          value_boolean: boolean | null;
          value_number: number | null;
          value_text: string | null;
        };
        Insert: {
          attribute_id: string;
          attribute_value_id?: string | null;
          created_at?: string;
          id?: string;
          product_id: string;
          value_boolean?: boolean | null;
          value_number?: number | null;
          value_text?: string | null;
        };
        Update: {
          attribute_id?: string;
          attribute_value_id?: string | null;
          created_at?: string;
          id?: string;
          product_id?: string;
          value_boolean?: boolean | null;
          value_number?: number | null;
          value_text?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_attributes_attribute_id_fkey";
            columns: ["attribute_id"];
            isOneToOne: false;
            referencedRelation: "attributes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_attributes_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_attributes_value_fkey";
            columns: ["attribute_id", "attribute_value_id"];
            isOneToOne: false;
            referencedRelation: "attribute_values";
            referencedColumns: ["attribute_id", "id"];
          },
        ];
      };
      product_images: {
        Row: {
          alt_text: string | null;
          created_at: string;
          id: string;
          is_primary: boolean;
          product_id: string;
          public_url: string | null;
          sort_order: number;
          storage_path: string;
          updated_at: string;
        };
        Insert: {
          alt_text?: string | null;
          created_at?: string;
          id?: string;
          is_primary?: boolean;
          product_id: string;
          public_url?: string | null;
          sort_order?: number;
          storage_path: string;
          updated_at?: string;
        };
        Update: {
          alt_text?: string | null;
          created_at?: string;
          id?: string;
          is_primary?: boolean;
          product_id?: string;
          public_url?: string | null;
          sort_order?: number;
          storage_path?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_type_attributes: {
        Row: {
          attribute_id: string;
          created_at: string;
          is_required: boolean;
          product_type_id: string;
          sort_order: number;
        };
        Insert: {
          attribute_id: string;
          created_at?: string;
          is_required?: boolean;
          product_type_id: string;
          sort_order?: number;
        };
        Update: {
          attribute_id?: string;
          created_at?: string;
          is_required?: boolean;
          product_type_id?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "product_type_attributes_attribute_id_fkey";
            columns: ["attribute_id"];
            isOneToOne: false;
            referencedRelation: "attributes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_type_attributes_product_type_id_fkey";
            columns: ["product_type_id"];
            isOneToOne: false;
            referencedRelation: "product_types";
            referencedColumns: ["id"];
          },
        ];
      };
      product_reviews: {
        Row: {
          author_name: string;
          body: string;
          created_at: string;
          id: string;
          product_id: string;
          rating: number;
          status: "PUBLISHED" | "HIDDEN";
          title: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          body: string;
          product_id: string;
          rating: number;
          title?: string | null;
        };
        Update: {
          body?: string;
          rating?: number;
          status?: "PUBLISHED" | "HIDDEN";
          title?: string | null;
        };
        Relationships: [];
      };
      product_types: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      product_variants: {
        Row: {
          combination_key: string;
          compare_at_price: number | null;
          created_at: string;
          id: string;
          image_id: string | null;
          is_active: boolean;
          price: number;
          product_id: string;
          sku: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          combination_key: string;
          compare_at_price?: number | null;
          created_at?: string;
          id?: string;
          image_id?: string | null;
          is_active?: boolean;
          price: number;
          product_id: string;
          sku: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          combination_key?: string;
          compare_at_price?: number | null;
          created_at?: string;
          id?: string;
          image_id?: string | null;
          is_active?: boolean;
          price?: number;
          product_id?: string;
          sku?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_variants_image_fkey";
            columns: ["product_id", "image_id"];
            isOneToOne: false;
            referencedRelation: "product_images";
            referencedColumns: ["product_id", "id"];
          },
        ];
      };
      products: {
        Row: {
          category_id: string | null;
          compare_at_price: number | null;
          created_at: string;
          currency_code: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          price: number;
          product_type_id: string | null;
          short_description: string | null;
          sku: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          category_id?: string | null;
          compare_at_price?: number | null;
          created_at?: string;
          currency_code: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          price: number;
          product_type_id?: string | null;
          short_description?: string | null;
          sku: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          category_id?: string | null;
          compare_at_price?: number | null;
          created_at?: string;
          currency_code?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          price?: number;
          product_type_id?: string | null;
          short_description?: string | null;
          sku?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_product_type_id_fkey";
            columns: ["product_type_id"];
            isOneToOne: false;
            referencedRelation: "product_types";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string | null;
          id: string;
          is_active: boolean;
          phone: string | null;
          role: Database["public"]["Enums"]["user_role"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          full_name?: string | null;
          id: string;
          is_active?: boolean;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          full_name?: string | null;
          id?: string;
          is_active?: boolean;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Relationships: [];
      };
      variant_attribute_values: {
        Row: {
          attribute_id: string;
          attribute_value_id: string;
          variant_id: string;
        };
        Insert: {
          attribute_id: string;
          attribute_value_id: string;
          variant_id: string;
        };
        Update: {
          attribute_id?: string;
          attribute_value_id?: string;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "variant_attribute_values_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "variant_attribute_values_attribute_id_fkey";
            columns: ["attribute_id"];
            isOneToOne: false;
            referencedRelation: "attributes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "variant_attribute_values_value_fkey";
            columns: ["attribute_id", "attribute_value_id"];
            isOneToOne: false;
            referencedRelation: "attribute_values";
            referencedColumns: ["attribute_id", "id"];
          },
        ];
      };
    };
    Views: {
      inventory_overview: {
        Row: {
          available_quantity: number | null;
          category_id: string | null;
          category_name: string | null;
          image_url: string | null;
          inventory_id: string | null;
          low_stock_threshold: number | null;
          name: string;
          product_active: boolean;
          product_id: string;
          quantity: number | null;
          reserved_quantity: number | null;
          sku: string;
          stock_status: "in_stock" | "low_stock" | "out_of_stock" | "unconfigured";
          updated_at: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      adjust_inventory: {
        Args: {
          p_product_id: string;
          p_type: Database["public"]["Enums"]["inventory_adjustment_type"];
          p_quantity: number;
          p_reason: Database["public"]["Enums"]["inventory_adjustment_reason"];
          p_notes?: string | null;
          p_expected_quantity?: number | null;
        };
        Returns: Database["public"]["Tables"]["inventory"]["Row"];
      };
      initialize_inventory: {
        Args: { p_product_id?: string | null };
        Returns: number;
      };
      inventory_summary: {
        Args: { p_include_inactive?: boolean };
        Returns: {
          total_products: number;
          in_stock: number;
          low_stock: number;
          out_of_stock: number;
          unconfigured: number;
          total_units: number;
          reserved_units: number;
        }[];
      };
      place_order: {
        Args: { p_address_id: string; p_checkout_key: string; p_expected_total: string };
        Returns: {
          placed_order_id: string;
          placed_order_number: number;
          placed_total: string;
          placed_currency: string;
        }[];
      };
      product_availability: {
        Args: { p_product_ids: string[] };
        Returns: { product_id: string; available: boolean }[];
      };
      product_review_summary: {
        Args: { p_product_id: string };
        Returns: {
          review_count: number;
          average_rating: number;
          stars_1: number;
          stars_2: number;
          stars_3: number;
          stars_4: number;
          stars_5: number;
        }[];
      };
      my_product_review: {
        Args: { p_product_id: string };
        Returns: {
          eligible: boolean;
          review_id: string | null;
          rating: number | null;
          title: string | null;
          body: string | null;
          status: "PUBLISHED" | "HIDDEN" | null;
          created_at: string | null;
          updated_at: string | null;
        }[];
      };
      variant_availability: {
        Args: { p_variant_ids: string[] };
        Returns: { variant_id: string; available: boolean }[];
      };
      delete_product_image: {
        Args: { p_image_id: string };
        Returns: string;
      };
      reorder_product_images: {
        Args: { p_product_id: string; p_image_ids: string[] };
        Returns: undefined;
      };
      set_primary_product_image: {
        Args: { p_image_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      inventory_adjustment_reason:
        | "stock_received"
        | "stock_count_correction"
        | "damaged"
        | "lost"
        | "returned"
        | "manual_correction"
        | "other";
      inventory_adjustment_type: "increase" | "decrease" | "set";
      order_status:
        "PENDING" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED";
      user_role: "ADMIN" | "CUSTOMER";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
