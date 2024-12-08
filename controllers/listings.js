const Listing = require("../models/listing");
const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const mapToken = process.env.MAP_TOKEN;
const geocodingClient = mbxGeocoding({ accessToken: mapToken });

module.exports.index = async (req, res) => {
  const { category } = req.query;

  let allListings = [];
  let noListingsFound = false;

  if (category && category !== "all") {
    const validCategories = [
      "trending",
      "rooms",
      "iconic-cities",
      "mountains",
      "castles",
      "amazing-pools",
      "farms",
      "camping",
      "arctic",
      "domes",
      "boats",
    ];

    if (validCategories.includes(category)) {
      allListings = await Listing.find({ category });
    } else {
      req.flash("error", "Invalid category!");
      return res.redirect("/listings");
    }

    if (allListings.length === 0) {
      return res.render("listings/nolisting");
    }
  } else {
    allListings = await Listing.find({});
  }

  res.render("listings/index", {
    allListings,
    currentCategory: category || "all",
    noListingsFound,
  });
};

module.exports.renderNewForm = (req, res) => {
  res.render("listings/new");
};

module.exports.showListing = async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id)
    .populate({
      path: "reviews",
      populate: {
        path: "author",
      },
    })
    .populate("owner");
  if (!listing) {
    req.flash("error", "Listing you requested for does not exist!");
    res.redirect("/listings");
  }

  res.render("listings/show", { listing });
};

module.exports.createListing = async (req, res, next) => {
  let response = await geocodingClient
    .forwardGeocode({
      query: req.body.listing.location,
      limit: 1,
    })
    .send();

  let url = req.file.path;
  let filename = req.file.filename;
  const newListing = new Listing(req.body.listing);
  newListing.owner = req.user._id;
  newListing.image = { url, filename };
  newListing.geometry = response.body.features[0].geometry;
  let savedListing = await newListing.save();

  req.flash("success", "New Listing Created!");
  res.redirect("/listings");
};

module.exports.searchByCategory = async (req, res) => {
  const { category } = req.query; // Category from query

  // Valid categories list
  const validCategories = [
    "trending",
    "rooms",
    "iconic-cities",
    "mountains",
    "castles",
    "amazing-pools",
    "farms",
    "camping",
    "arctic",
    "domes",
    "boats",
  ];

  // If category is invalid, return error
  if (!validCategories.includes(category)) {
    return res.status(400).send("Invalid category");
  }

  try {
    const listings = await Listing.find({ category }); // Filter listings by category
    if (listings.length === 0) {
      return res.status(404).send("No listings found for this category");
    }
    res.render("listings/index", { listings, currentCategory: category });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

module.exports.searchListings = async (req, res) => {
  const { query, country } = req.query;

  if (!query && !country) {
    req.flash("error", "Please enter a search query or select a country.");
    return res.redirect("/listings");
  }

  let searchCriteria = {};

  // if (query) {
  //   searchCriteria.title = { $regex: query, $options: "i" }; // Case-insensitive search
  // }

  if (query) {
    searchCriteria.country = query;
  }

  try {
    const listings = await Listing.find(searchCriteria);

    if (listings.length === 0) {
      return res.status(404).render("listings/noListing", { query, country });
    }

    res.render("listings/searchResults", { listings, query, country });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

module.exports.renderEditForm = async (req, res) => {
  let { id } = req.params;
  const listing = await Listing.findById(id);
  if (!listing) {
    req.flash("error", "Listing you requested for does not exist!");
    return res.redirect("/listings");
  }

  let originalImageUrl = listing.image.url;
  originalImageUrl = originalImageUrl.replace("/upload", "/upload/w_250");
  res.render("listings/edit", { listing, originalImageUrl });
};

module.exports.updateListing = async (req, res) => {
  const { id } = req.params;
  const updatedData = { ...req.body.listing };

  // Check if an image URL is provided; if not, retain the existing image
  if (req.body.listing.image && req.body.listing.image.url) {
    updatedData.image = {
      filename: req.body.listing.image.filename || "listingimage",
      url: req.body.listing.image.url,
    };
  } else {
    // Keep the existing image if no new URL is provided
    const currentListing = await Listing.findById(id);
    updatedData.image = currentListing.image;
  }

  try {
    let listing = await Listing.findByIdAndUpdate(id, updatedData, {
      new: true,
      runValidators: true,
    });
    if (typeof req.file !== "undefined") {
      let url = req.file.path;
      let filename = req.file.filename;
      listing.image = { url, filename };
      await listing.save();
    }
    req.flash("success", " Listing Updated!");
    res.redirect(`/listings/${id}`);
  } catch (error) {
    console.error(error);
    res.status(500).send("Something went wrong");
  }
};

module.exports.destroyListing = async (req, res) => {
  let { id } = req.params;
  let deletedListing = await Listing.findByIdAndDelete(id);
  console.log(deletedListing);
  req.flash("success", "Listing Deleted!");
  res.redirect("/listings");
};
