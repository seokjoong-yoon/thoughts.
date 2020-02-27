exports.getDate = function() {

    const today = new Date();

    const options = {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    };

    return today.toLocaleDateString("en-US", options);

};